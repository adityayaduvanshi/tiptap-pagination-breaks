# tiptap-pagination-breaks

`**tiptap-pagination-breaks**` is a Tiptap extension that enables automatic pagination and page breaks within your Tiptap editor. Perfect for applications that require document-like editing features with defined page heights and visual page breaks.

## Features

- **Automatic Pagination**: Handles content overflow by adding page breaks based on defined page dimensions.
- **Customizable Page Settings**: Configure page height, width, and margin to control how content is paginated.
- **Visual Page Breaks**: Inserts dashed lines to represent page boundaries in the editor.

## Installation

```bash
npm install tiptap-pagination-breaks
```

or

```
yarn add tiptap-pagination-breaks
```

## Usage

To use this extension, include it in your Tiptap editor setup:

```bash
import { Pagination } from 'tiptap-pagination-breaks';
import { Editor } from '@tiptap/core';

const editor = new Editor({
  extensions: [
    Pagination.configure({
      pageHeight: 1056, // default height of the page
      pageWidth: 816,   // default width of the page
      pageMargin: 96,   // default margin of the page
    }),
    // other extensions
  ],
});
```

### Commands

You can dynamically update pagination options through the provided command:

```bash
editor.commands.setPaginationOptions({
  pageHeight: 900,
  pageMargin: 80
});
```

### Styles

Ensure you have a global style to define how the page break will look visually:

```bash
.page-break {
  height: 20px;
  width: 100%;
  border-top: 1px dashed #ccc;
  margin: 10px 0;
}
```

### Available Options

pageHeight: Height of each page in the editor (default: 1056).
pageWidth: Width of each page in the editor (default: 816).
pageMargin: Margin around the content on each page (default: 96).

### Example

This extension is useful when you need to visualize content divided into pages, like in a document editor or a publishing platform.

## License

This project is licensed under the MIT License.

### Made with ❤️ by Aditya Yaduvanshi

For any questions or suggestions, feel free to reach out via [email](mailto:aditya97y@gmail.com) or connect with me on [LinkedIn](https://www.linkedin.com/in/theaditya-yaduvanshi-/).
