import { common } from './common';
import { fetch } from './fetch';
import { auth } from './auth';
import { collections } from './collections';
import { environment } from './environment';
import { history } from './history';
import { intercept } from './intercept';
import { breakpoints } from './breakpoints';
import { mappings } from './mappings';
import { stitch } from './stitch';
import { settings } from './settings';
import { import_ } from './import_';
import { tour } from './tour';
import { help } from './help';
import { sidebar } from './sidebar';

export const translations = {
  ...common,
  ...fetch,
  ...auth,
  ...collections,
  ...environment,
  ...history,
  ...intercept,
  ...breakpoints,
  ...mappings,
  ...stitch,
  ...settings,
  ...import_,
  ...tour,
  ...help,
  ...sidebar,
} as const;
