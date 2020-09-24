import localizedLanguageMap from './localizedLanguageMap';
import { locales, localesShortNames } from 'mwp-config';

describe('localizedLanguageMap', () => {
	it('has a localized name for every item in `mwp-config/locales`', () => {
		locales.forEach(locale => {
			expect(Object.keys(localizedLanguageMap).includes(locale)).toBeTruthy();
		});
	});
	it('has a localized name for every item in `mwp-config/localesShortNames`', () => {
		localesShortNames.forEach(locale => {
			expect(Object.keys(localizedLanguageMap).includes(locale)).toBeTruthy();
		});
	});
});
