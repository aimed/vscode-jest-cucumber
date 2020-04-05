import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import gherkin from 'gherkin';
import { Readable } from 'stream';
import { messages } from '@cucumber/messages';
import { promisify } from 'util';
import { createFeature } from './createFeature';

export const NEW_LINE = '\r\n';
const fsExists = promisify(fs.exists);

export function activate(context: vscode.ExtensionContext) {
	let provider2 = vscode.commands.registerCommand('extension.jest-cucumber.defineFeatures', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const gherkinDocuments = await tryGetGherkinDocumentsLoadedFromDocument(editor.document);
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

async function tryGetGherkinDocumentsLoadedFromDocument(document: vscode.TextDocument): Promise<messages.IGherkinDocument[] | undefined> {
	const loadedFeaturePath = getAbsoluteFeaturePathIfLoaded(document);
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
		.map(envelope => envelope.gherkinDocument)
		.filter((maybeDocument): maybeDocument is messages.IGherkinDocument => maybeDocument != null);

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

function getAbsoluteFeaturePathIfLoaded(document: vscode.TextDocument) {
	const loadFeatureMatch = document.getText().match(/loadFeature\(.(.+).\)/) || [];
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
