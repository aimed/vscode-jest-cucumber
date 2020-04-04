/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import gherkin from 'gherkin';
import { Readable } from 'stream';
import { messages } from '@cucumber/messages';
import { promisify } from 'util';

const NEW_LINE = '\r\n';
const DOUBLE_NEW_LINE = `${NEW_LINE}${NEW_LINE}`;

export function activate(context: vscode.ExtensionContext) {
	let provider2 = vscode.commands.registerCommand('extension.jest-cucumber.defineFeatures', async () => {
		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			return;
		}

		const document = editor.document;
		const feature = await createDefineFeature(document);

		editor.edit(builder => {
			if (feature) {
				builder.insert(editor.selection.start, feature);
			}
		});
	});
	context.subscriptions.push(provider2);
}

async function createDefineFeature(document: vscode.TextDocument): Promise<string | undefined> {
	const loadedFeaturePath = getLoadedFeaturePath(document);
	if (!loadedFeaturePath) {
		return;
	}

	if (!await promisify(fs.exists)(loadedFeaturePath)) {
		return;
	}

	const featureStream = gherkin.fromPaths([loadedFeaturePath]);
	const gherkinEnvelopes = await streamToArray(featureStream);
	const gherkinDocuments = gherkinEnvelopes.filter(e => e.gherkinDocument).map(e => e.gherkinDocument!);
	if (gherkinDocuments.length === 0) {
		return `defineFeature(feature, test => {})`;
	}

	const features = gherkinDocuments.map(createFeatures).map(scenarioFeatures => scenarioFeatures.join(DOUBLE_NEW_LINE));
	if (!features) {
		return `defineFeature(feature, test => {})`;
	}


	return `defineFeature(feature, test => {${features.join(DOUBLE_NEW_LINE)}})`;
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

function createFeatures(gherkinDocument: messages.IGherkinDocument): string[] {
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
			${scenario.steps.map(implementStep).join(DOUBLE_NEW_LINE)}
		})`;


	function implementStep(step: messages.GherkinDocument.Feature.IStep): string {
		if (!step.keyword || !step.text) {
			return '';
		}

		if (step.keyword !== 'And ') {
			keyword = step.keyword;
		}

		// Handle scenario variables like 'When I sell the <Item>'
		const vars = step.text.match(/<([^<]+)>/g) || [];
		const args = vars.map(v => "var" + v.replace(/<|>/g, '') + ": string").join(', ');
		const name = vars.length === 0 ? `'${step.text}'` : `/^${step.text.replace(/\\|\(|\)|\$|\^/g, (v) => `\\${v}`).replace(/<([^<]+)>/g, '(.*)')}$/`;
		const method = keyword.replace(' ', '').toLowerCase();
		return `${method}(${name}, async (${args}) => {})`;
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