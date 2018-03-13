import { Style } from '@glitz/type';
import Base, { DEFAULT_HYDRATE_CLASS_NAME } from '../core/Base';
import { Options } from '../types/options';
import { createStyleElement, insertStyleElement } from '../utils/dom';
import { createHashCounter } from '../utils/hash';
import InjectorClient from './InjectorClient';

export default class GlitzClient<TStyle = Style> extends Base<TStyle> {
  constructor(
    styleElements?: HTMLStyleElement[] | NodeListOf<Element> | HTMLCollectionOf<Element> | 'auto' | null,
    options: Options = {},
  ) {
    const prefix = options.prefix;
    const classHasher = createHashCounter(prefix);
    const keyframesHasher = createHashCounter(prefix);
    const fontFaceHasher = createHashCounter(prefix);

    const mediaOrderOption = options.mediaOrder;
    const mediaSheets: { [media: string]: HTMLStyleElement } = {};
    let initialMediaSheet: HTMLStyleElement | null = null;

    let plain: InjectorClient;
    const mediaIndex: {
      [media: string]: InjectorClient;
    } = {};

    const injector = (media?: string) => {
      if (media) {
        if (mediaIndex[media]) {
          return mediaIndex[media];
        }

        const element = (mediaSheets[media] = createStyleElement(media));

        let insertBefore: HTMLStyleElement | null = null;
        if (mediaOrderOption) {
          const orderedMediaKeys = Object.keys(mediaSheets).sort(mediaOrderOption);
          initialMediaSheet = mediaSheets[orderedMediaKeys[0]];
          insertBefore = mediaSheets[orderedMediaKeys[orderedMediaKeys.indexOf(media) + 1]] || null;
        }

        insertStyleElement(element, insertBefore);

        return (mediaIndex[media] = new InjectorClient(element, classHasher, keyframesHasher, fontFaceHasher));
      } else {
        if (plain) {
          return plain;
        }

        const element = insertStyleElement(createStyleElement(media), initialMediaSheet);

        return (plain = new InjectorClient(element, classHasher, keyframesHasher, fontFaceHasher));
      }
    };

    super(injector, options.transformer, options.atomic);

    if (styleElements === 'auto') {
      styleElements = document.getElementsByClassName(DEFAULT_HYDRATE_CLASS_NAME) as HTMLCollectionOf<HTMLStyleElement>;
    }

    if (styleElements) {
      if (process.env.NODE_ENV !== 'production') {
        if (typeof (styleElements as any)[Symbol.iterator] !== 'function') {
          throw new Error(
            'The argument passed to `GlitzClient` needs to be an iterable list of style elements like an array or an array-like object (using e.g. `document.getElementsByClassName`, `document.querySelectorAll`)',
          );
        }
        if (styleElements.length === 0) {
          console.warn(
            'The argument passed to `GlitzClient` with style elements was empty so there will be no hydrated CSS from the server',
          );
        }
      }

      for (const element of (styleElements as any) as Iterable<HTMLStyleElement>) {
        // Injector for style elements without `media` is stored with an empty key. So if there's any reason to have
        // more than one of these in the future we need to change that part.
        const media = element.media;

        if (media) {
          if (!initialMediaSheet) {
            initialMediaSheet = element;
          }
          mediaSheets[media] = element;
          mediaIndex[media] = new InjectorClient(element, classHasher, keyframesHasher, fontFaceHasher);
        } else {
          plain = new InjectorClient(element, classHasher, keyframesHasher, fontFaceHasher);
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        if (mediaOrderOption) {
          // Verify hydrated style element order
          const medias = Object.keys(mediaSheets);
          const orderedMedias = medias.sort(mediaOrderOption);
          for (const index in medias) {
            if (medias[index] !== orderedMedias[index]) {
              console.error(
                'The order of media queries rendered by the server did not meet the expected ' +
                  'order by the browser. Make sure you pass the same function to the `mediaOrder`' +
                  'option for both `GlitzServer` and `GlitzClient`.',
              );
              break;
            }
          }
        }
      }
    }
  }
}
