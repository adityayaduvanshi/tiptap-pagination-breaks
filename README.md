# tiptap-pagination-breaks

**tiptap-pagination-breaks** is a Tiptap extension that brings Google-Docs– and
Notion-style automatic pagination to the Tiptap editor.  Content is measured at
runtime and visual page-break separators are inserted as ProseMirror decorations
whenever a block overflows a page boundary.

## Features

- **Automatic pagination** – page breaks are recalculated on every document change.
- **Google-Docs paper look** – white page with drop shadow on a gray "desk" background (opt-in).
- **Named page-size presets** – A4, US Letter, Legal, Tabloid, Executive.
- **Independent per-side margins** – set `pageMarginTop`, `pageMarginBottom`, `pageMarginLeft`, `pageMarginRight` individually.
- **Manual / hard page breaks** – insert a `PageBreakNode` anywhere to force a new page.
- **Configurable page-gap** – control the height of the gray separator strip between pages.
- **Page-count callback** – get notified when the total number of pages changes.
- **Optional page numbers** – shown inside the separator strip.
- **Fully typed** – ships TypeScript declarations.

## Installation

```bash
npm install tiptap-pagination-breaks
# or
yarn add tiptap-pagination-breaks
```

## Basic usage

```ts
import { Editor } from '@tiptap/core';
import { Pagination } from 'tiptap-pagination-breaks';

const editor = new Editor({
  extensions: [
    Pagination.configure({
      pageHeight: 1056,   // px – US Letter default
      pageWidth:  816,    // px
      pageMargin: 96,     // px – applied to all four sides
      showPageNumber: true,
      label: 'Page',
    }),
    // …other extensions
  ],
});
```

## Named page-size presets

```ts
import { Pagination, PageSize } from 'tiptap-pagination-breaks';

Pagination.configure({ pageSize: PageSize.A4 });
// Available: PageSize.A4 | PageSize.Letter | PageSize.Legal
//            PageSize.Tabloid | PageSize.Executive
```

You can still override `pageWidth` or `pageHeight` after setting `pageSize`.

## Independent margins

```ts
Pagination.configure({
  pageMarginTop:    72,
  pageMarginBottom: 72,
  pageMarginLeft:   96,
  pageMarginRight:  96,
});
```

Any side that is **not** set falls back to `pageMargin`.

## Turning off the paper style

```ts
Pagination.configure({ paperStyle: false });
```

When `false` the extension does not touch background colours or shadows, letting
your own CSS take control.

## Page-gap size

```ts
Pagination.configure({ pageGap: 32 }); // default: 24
```

## Page-count callback

```ts
Pagination.configure({
  onPageCountChange: (count) => {
    console.log(`Document is now ${count} page(s)`);
  },
});
```

## Manual hard page break (`PageBreakNode`)

Import and register the companion node extension to allow users (or your code) to
insert explicit page breaks that are stored in the document:

```ts
import { Pagination, PageBreakNode } from 'tiptap-pagination-breaks';

const editor = new Editor({
  extensions: [
    Pagination.configure({ /* … */ }),
    PageBreakNode,
    // …
  ],
});

// Insert a hard break at the current cursor position:
editor.commands.insertContent({ type: 'pageBreakNode' });
```

Hard page breaks are selectable and deletable just like any other block node.

## Dynamic option updates

Options can be updated at any time without recreating the editor:

```ts
editor.commands.setPaginationOptions({
  pageSize: PageSize.A4,
  showPageNumber: false,
  pageGap: 40,
});
```

## CSS customisation

The extension injects minimal inline styles so it works without a stylesheet, but
every element carries a class name you can override:

| Selector | Element |
|---|---|
| `.page-break` | Outer wrapper of each automatic separator |
| `.page-break__gap` | The gray strip between pages |
| `.page-break__label` | Page-number text inside the strip |
| `.hard-page-break` | The `PageBreakNode` rendered element |

### Print styles

Add the following to your global stylesheet to produce clean printed output:

```css
@media print {
  .page-break,
  .hard-page-break {
    display: none !important;
  }

  .ProseMirror {
    width: 100% !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
}
```

## All options

| Option | Type | Default | Description |
|---|---|---|---|
| `pageWidth` | `number` | `816` | Page width in pixels |
| `pageHeight` | `number` | `1056` | Page height in pixels |
| `pageMargin` | `number` | `96` | Uniform margin for all sides (px) |
| `pageMarginTop` | `number?` | — | Top margin (overrides `pageMargin`) |
| `pageMarginBottom` | `number?` | — | Bottom margin (overrides `pageMargin`) |
| `pageMarginLeft` | `number?` | — | Left margin (overrides `pageMargin`) |
| `pageMarginRight` | `number?` | — | Right margin (overrides `pageMargin`) |
| `pageSize` | `PageSize?` | — | Named preset; sets `pageWidth`/`pageHeight` |
| `showPageNumber` | `boolean` | `true` | Show page numbers in the separator |
| `label` | `string` | `"Page"` | Prefix for page numbers |
| `pageGap` | `number` | `24` | Height of the gap strip between pages (px) |
| `paperStyle` | `boolean` | `true` | Google-Docs–style paper appearance |
| `onPageCountChange` | `function?` | — | Called when the total page count changes |

## License

MIT © [Aditya Yaduvanshi](mailto:aditya97y@gmail.com)

Connect on [LinkedIn](https://www.linkedin.com/in/theaditya-yaduvanshi-/).
