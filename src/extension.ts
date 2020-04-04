import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import gherkin from 'gherkin';
import { Readable } from 'stream';
import { messages } from '@cucumber/messages';
import { promisify } from 'util';

const NEW_LINE = '\r\n';
const fsExists = promisify(fs.exists);

export function activate(context: vscode.ExtensionContext) {
	let provider2 = vscode.commands.registerCommand('extension.jest-cucumber.defineFeatures', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const gherkinDocuments = await tryGetGherkinDocumentsLoadedFromActiveEditor(editor);
		if (!gherkinDocuments) {
			return;
		}

		const feature = createDefineFeature(gherkinDocuments);

		if (feature) {
			editor.edit(builder => {
				builder.insert(editor.selection.start, feature);
			});
		}
	});
	context.subscriptions.push(provider2);
}

async function tryGetGherkinDocumentsLoadedFromActiveEditor(editor: vscode.TextEditor): Promise<messages.IGherkinDocument[] | undefined> {
	const loadedFeaturePath = getLoadedFeaturePath(editor.document);
	if (!loadedFeaturePath) {
		return;
	}

	if (!await fsExists(loadedFeaturePath)) {
		return;
	}

	const gherkinDocuments = await getLoadedGherkinDocuments(loadedFeaturePath);
	return gherkinDocuments;
}

async function getLoadedGherkinDocuments(loadedFeaturePath: string): Promise<messages.IGherkinDocument[]> {
	const stream = gherkin.fromPaths([loadedFeaturePath]);
	const gherkinEnvelopes = await streamToArray(stream);
	const gherkinDocuments = gherkinEnvelopes
		.filter(e => e.gherkinDocument)
		.map(e => e.gherkinDocument!);
	return gherkinDocuments;
}

function createDefineFeature(gherkinDocuments: messages.IGherkinDocument[]): string {
	const features = gherkinDocuments
		.map(createScenarioFeatures)
		.map(scenarioFeatures => scenarioFeatures.join(NEW_LINE));

	return `
		defineFeature(feature, test => {
			${features.join(NEW_LINE)}
		})
	`;
}

function getLoadedFeaturePath(document: vscode.TextDocument) {
	const loadFeatureMatch = document.getText().match(/loadFeature\(.(.+).\)/);
	if (!loadFeatureMatch) {
		return;
	}

	const [, relativeFeaturePath] = loadFeatureMatch;
	if (!relativeFeaturePath) {
		return;
	}

	const absoluteFeaturePath = path.join(path.dirname(document.fileName), relativeFeaturePath);
	return absoluteFeaturePath;
}

function createScenarioFeatures(gherkinDocument: messages.IGherkinDocument): string[] {
	if (!gherkinDocument.feature || !gherkinDocument.feature.children) {
		return [];
	}

	return gherkinDocument.feature.children.map(createFeature);
}

function createFeature({ scenario }: messages.GherkinDocument.Feature.IFeatureChild): string {
	if (!scenario || !scenario.steps) {
		return '';
	}

	// The gherkin document will output `And `, jest-cucumber does not provide `and()`, but only `given`, `when` and 
	// `then`. We thus have to remember what the last keyword is that was used in the document.
	let keyword = 'Given ';

	return `
		test('${scenario.name}', ({ given, when, then }) => {
			${scenario.steps.map(createStep).join(NEW_LINE)}
		})
	`;


	function createStep(step: messages.GherkinDocument.Feature.IStep): string {
		if (!step.keyword || !step.text) {
			return '';
		}

		if (step.keyword !== 'And ') {
			keyword = step.keyword;
		}

		// Handle scenario variables like 'When I sell the <Item>'
		const vars = step.text.match(/<([^<]+)>/g) || [];
		const args = vars.map(v => "var" + v.replace(/<|>/g, '') + ": string").join(', ');
		const text = vars.length === 0 ? `'${step.text}'` : `/^${step.text.replace(/\\|\(|\)|\$|\^/g, (v) => `\\${v}`).replace(/<([^<]+)>/g, '(.*)')}$/`;
		const method = keyword.replace(' ', '').toLowerCase();
		return `
			${method}(${text}, async (${args}) => {

			})
		`;
	}
}

async function streamToArray(
	readableStream: Readable
): Promise<messages.IEnvelope[]> {
	return new Promise<messages.IEnvelope[]>(
		(
			resolve: (wrappers: messages.IEnvelope[]) => void,
			reject: (err: Error) => void
		) => {
			const items: messages.IEnvelope[] = [];
			readableStream.on('data', data => items.push(data));
			readableStream.on('error', (err: Error) => reject(err));
			readableStream.on('end', () => resolve(items));
		}
	);
}

// let provider1 = vscode.languages.registerCompletionItemProvider(['javascript', 'typescript', 'javascriptreact', 'typescriptreact'], {
// 	async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
// 		const feature = await createDefineFeature(document);
// 		if (!feature) {
// 			return [];
// 		}
// 		return [
// 			new vscode.CompletionItem(feature)
// 		];
// 	}
// });
// context.subscriptions.push(provider1);