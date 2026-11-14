import heroCoffeeRoastery from '../assets/images/hero_coffee_roastery_1794597282613.jpg';
import prodArabicaBeans from '../assets/images/prod_arabica_beans_1794597282299.jpg';
import prodPaperCups from '../assets/images/prod_paper_cups_1794597282693.jpg';
import prodCoffeeSyrup from '../assets/images/prod_coffee_syrup_1794597284740.jpg';
import prodBaristaTools from '../assets/images/prod_barista_tools_1794597284059.jpg';
import prodMachineCleaner from '../assets/images/prod_machine_cleaner_1794597284372.jpg';
import prodCocoaPowder from '../assets/images/prod_cocoa_powder_1794597285017.jpg';
import prodV60Filters from '../assets/images/prod_v60_filters_1794597285126.jpg';

export const MEDIA_ASSETS: Record<string, string> = {
  hero_coffee_roastery: heroCoffeeRoastery,
  prod_arabica_beans: prodArabicaBeans,
  prod_paper_cups: prodPaperCups,
  prod_coffee_syrup: prodCoffeeSyrup,
  prod_barista_tools: prodBaristaTools,
  prod_machine_cleaner: prodMachineCleaner,
  prod_cocoa_powder: prodCocoaPowder,
  prod_v60_filters: prodV60Filters,
};

export function resolveMediaUrl(keyOrPath?: string | null): string {
  if (!keyOrPath) return prodArabicaBeans;
  if (MEDIA_ASSETS[keyOrPath]) return MEDIA_ASSETS[keyOrPath];
  if (keyOrPath.startsWith('http') || keyOrPath.startsWith('/api/') || keyOrPath.startsWith('data:')) {
    return keyOrPath;
  }
  const matchedKey = Object.keys(MEDIA_ASSETS).find((k) => keyOrPath.includes(k));
  if (matchedKey) return MEDIA_ASSETS[matchedKey];
  return prodArabicaBeans;
}
