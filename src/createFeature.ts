import { messages } from '@cucumber/messages';
import { NEW_LINE } from './extension';

export function createFeature({ scenario }: messages.GherkinDocument.Feature.IFeatureChild): string {
	if (!scenario || !scenario.steps) {
		return '';
	}
	// The gherkin document will output `And `, jest-cucumber does not provide `and()`, but only `given`, `when` and 
	// `then`. We thus have to remember what the last keyword is that was used in the document.
	let lastKeyword = 'Given ';

	return `
		test('${scenario.name}', ({ given, when, then }) => {
			${
		scenario.steps.map(step => {
			if (!step.keyword || !step.text) {
				return '';
			}

			if (step.keyword !== 'And ') {
				lastKeyword = step.keyword;
			}

			return createStep(lastKeyword, step.text);
		}).join(NEW_LINE)
		}
		})
	`;
}

function createStep(keyword: string, text: string): string {
	// Handle scenario variables like 'When I sell the <Item>'
	const vars = text.match(/<([^<]+)>/g) || [];
	const args = vars.map(v => "var" + v.replace(/<|>/g, '') + ": string").join(', ');
	const escapedText = vars.length === 0 ? `'${text}'` : `/^${text.replace(/\\|\(|\)|\$|\^/g, (v) => `\\${v}`).replace(/<([^<]+)>/g, '(.*)')}$/`;
	const method = keyword.replace(' ', '').toLowerCase();
	return `
			${method}(${escapedText}, async (${args}) => {

			})
		`;
}