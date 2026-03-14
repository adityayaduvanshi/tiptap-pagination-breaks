import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { Node as PMNode } from 'prosemirror-model';

// ─── Page-size presets ────────────────────────────────────────────────────────

/** Named page-size presets (dimensions in pixels at 96 dpi). */
export enum PageSize {
  A4 = 'A4',
  Letter = 'Letter',
  Legal = 'Legal',
  Tabloid = 'Tabloid',
  Executive = 'Executive',
}

/** Pixel dimensions for each PageSize preset. */
export const PAGE_SIZE_PRESETS: Record<PageSize, { width: number; height: number }> = {
  [PageSize.A4]:        { width: 794,  height: 1123 },
  [PageSize.Letter]:    { width: 816,  height: 1056 },
  [PageSize.Legal]:     { width: 816,  height: 1344 },
  [PageSize.Tabloid]:   { width: 1056, height: 1632 },
  [PageSize.Executive]: { width: 696,  height: 1008 },
};

// ─── Options ──────────────────────────────────────────────────────────────────

export interface PaginationOptions {
  /** Page width in pixels (default: 816 – US Letter). */
  pageWidth: number;
  /** Page height in pixels (default: 1056 – US Letter). */
  pageHeight: number;
  /**
   * Uniform page margin in pixels applied to all four sides.
   * Acts as a fallback when individual side margins are not set (default: 96).
   */
  pageMargin: number;
  /** Top content margin in pixels – overrides `pageMargin`. */
  pageMarginTop?: number;
  /** Bottom content margin in pixels – overrides `pageMargin`. */
  pageMarginBottom?: number;
  /** Left content margin in pixels – overrides `pageMargin`. */
  pageMarginLeft?: number;
  /** Right content margin in pixels – overrides `pageMargin`. */
  pageMarginRight?: number;
  /**
   * Preset page size. When supplied, `pageWidth` and `pageHeight` are derived
   * from `PAGE_SIZE_PRESETS` and any explicit values for those options are
   * ignored.
   */
  pageSize?: PageSize;
  /** Show page-number labels on automatic page-break separators (default: true). */
  showPageNumber: boolean;
  /** Label prefix shown before the page number, e.g. "Page" → "Page 2" (default: "Page"). */
  label: string;
  /**
   * Callback invoked (asynchronously) whenever the total page count changes.
   * Useful for displaying a page counter in surrounding UI.
   */
  onPageCountChange?: (pageCount: number) => void;
  /** Height in pixels of the visual gap rendered between pages (default: 24). */
  pageGap: number;
  /**
   * When `true` the editor gains a Google-Docs–style paper look: white page
   * with a drop shadow on a light-gray desk background (default: true).
   */
  paperStyle: boolean;
}

interface ResolvedMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

// ─── Command type augmentation ────────────────────────────────────────────────

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pagination: {
      /** Dynamically update any subset of pagination options at runtime. */
      setPaginationOptions: (options: Partial<PaginationOptions>) => ReturnType;
    };
  }
}

// ─── PageBreakNode – explicit / manual hard page break ────────────────────────

/**
 * A block-level atom node that forces an explicit page break at its position.
 *
 * Insert it with:
 * ```ts
 * editor.commands.insertContent({ type: 'pageBreakNode' })
 * ```
 * The node is selectable and draggable like any other block, so the user can
 * delete it with Backspace or Delete.
 */
export const PageBreakNode = Node.create({
  name: 'pageBreakNode',

  group: 'block',

  /** Atom means no child content – the node is treated as a single unit. */
  atom: true,

  selectable: true,

  draggable: true,

  parseHTML() {
    return [{ tag: 'div[data-hard-page-break]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-hard-page-break': '',
        class: 'hard-page-break',
        style: [
          'display:block',
          'width:100%',
          'page-break-before:always',
          'break-before:page',
        ].join(';'),
      }),
    ];
  },
});

// ─── Pagination Extension ─────────────────────────────────────────────────────

export const Pagination = Extension.create<PaginationOptions>({
  name: 'pagination',

  addOptions() {
    return {
      pageHeight:     1056,
      pageWidth:      816,
      pageMargin:     96,
      showPageNumber: true,
      label:          'Page',
      pageGap:        24,
      paperStyle:     true,
    };
  },

  addCommands() {
    return {
      setPaginationOptions:
        (incoming: Partial<PaginationOptions>) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            // Expand a preset so downstream consumers only deal with px values.
            if (incoming.pageSize && PAGE_SIZE_PRESETS[incoming.pageSize]) {
              incoming = { ...incoming, ...PAGE_SIZE_PRESETS[incoming.pageSize] };
            }
            tr.setMeta('paginationOptions', incoming);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey<PaginationOptions>('pagination');
    const ext       = this;
    let lastPageCount = 0;

    return [
      new Plugin<PaginationOptions>({
        key: pluginKey,

        // ── Plugin state ────────────────────────────────────────────────────
        state: {
          init: () => resolvePreset({ ...ext.options }),
          apply: (tr, prev) => {
            const patch = tr.getMeta('paginationOptions') as Partial<PaginationOptions> | undefined;
            return patch ? resolvePreset({ ...prev, ...patch }) : prev;
          },
        },

        // ── Container styling ────────────────────────────────────────────────
        view: (editorView) => {
          applyContainerStyles(editorView, pluginKey.getState(editorView.state)!);
          return {
            update(view) {
              applyContainerStyles(view, pluginKey.getState(view.state)!);
            },
          };
        },

        // ── Decorations (page-break widgets) ────────────────────────────────
        props: {
          decorations(state) {
            const { doc }   = state;
            const options   = pluginKey.getState(state)!;
            const margins   = resolveMargins(options);
            const effectiveHeight = options.pageHeight - margins.top - margins.bottom;

            const decorations: Decoration[] = [];
            let usedHeight = 0;
            let pageNumber = 1;

            // Iterate only top-level document children to avoid double-counting
            // heights of nested nodes (e.g. list containers vs list items).
            doc.forEach((node: PMNode, pos: number) => {
              if (!node.isBlock) return;

              // ── Hard (manual) page break ────────────────────────────────
              if (node.type.name === 'pageBreakNode') {
                decorations.push(
                  buildPageBreakWidget(pos, pageNumber, options, margins),
                );
                pageNumber++;
                usedHeight = 0;
                return;
              }

              // ── Measure the DOM node ─────────────────────────────────────
              const domNode = ext.editor.view.nodeDOM(pos);
              if (!(domNode instanceof HTMLElement)) return;

              const nodeHeight = measureNodeHeight(domNode);
              if (nodeHeight <= 0) return;

              if (usedHeight > 0 && usedHeight + nodeHeight > effectiveHeight) {
                // Block overflows current page → automatic break before it.
                decorations.push(
                  buildPageBreakWidget(pos, pageNumber, options, margins),
                );
                pageNumber++;
                usedHeight = nodeHeight;
              } else {
                usedHeight += nodeHeight;
              }
            });

            // ── Notify listeners of page-count changes ───────────────────
            const totalPages = pageNumber;
            if (totalPages !== lastPageCount) {
              lastPageCount = totalPages;
              if (options.onPageCountChange) {
                // Defer to avoid state mutation during a render cycle.
                Promise.resolve().then(() => options.onPageCountChange!(totalPages));
              }
            }

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** If a `pageSize` preset is set, override `pageWidth`/`pageHeight`. */
function resolvePreset(options: PaginationOptions): PaginationOptions {
  if (options.pageSize && PAGE_SIZE_PRESETS[options.pageSize]) {
    return { ...options, ...PAGE_SIZE_PRESETS[options.pageSize] };
  }
  return options;
}

/** Compute the four content-area margins from the options object. */
function resolveMargins(options: PaginationOptions): ResolvedMargins {
  const fallback = options.pageMargin;
  return {
    top:    options.pageMarginTop    ?? fallback,
    bottom: options.pageMarginBottom ?? fallback,
    left:   options.pageMarginLeft   ?? fallback,
    right:  options.pageMarginRight  ?? fallback,
  };
}

/**
 * Full vertical space an element occupies, including its CSS block margins.
 * This mirrors what a browser uses for block layout flow.
 */
function measureNodeHeight(el: HTMLElement): number {
  const style       = window.getComputedStyle(el);
  const marginTop    = parseFloat(style.marginTop)    || 0;
  const marginBottom = parseFloat(style.marginBottom) || 0;
  return el.offsetHeight + marginTop + marginBottom;
}

/**
 * Style the `.ProseMirror` editor element and its parent wrapper to produce
 * a paper-on-desk appearance.  Called from the plugin's `view.update` hook so
 * it runs after every transaction that may change options.
 */
function applyContainerStyles(view: EditorView, options: PaginationOptions): void {
  const editorEl = view.dom as HTMLElement;
  const margins  = resolveMargins(options);

  // Page dimensions & content margins
  editorEl.style.width         = `${options.pageWidth}px`;
  editorEl.style.boxSizing     = 'border-box';
  editorEl.style.margin        = '0 auto';
  editorEl.style.paddingTop    = `${margins.top}px`;
  editorEl.style.paddingBottom = `${margins.bottom}px`;
  editorEl.style.paddingLeft   = `${margins.left}px`;
  editorEl.style.paddingRight  = `${margins.right}px`;

  if (options.paperStyle) {
    editorEl.style.background    = '#ffffff';
    editorEl.style.boxShadow     = '0 1px 4px rgba(0,0,0,0.14), 0 3px 8px rgba(0,0,0,0.08)';
    editorEl.style.borderRadius  = '2px';
  } else {
    editorEl.style.background    = '';
    editorEl.style.boxShadow     = '';
    editorEl.style.borderRadius  = '';
  }

  // Style the parent container ("the desk") when paperStyle is enabled
  const parent = editorEl.parentElement;
  if (parent) {
    if (options.paperStyle) {
      parent.style.background = '#f0f0f0';
      parent.style.padding    = '40px 0';
      parent.style.minHeight  = '100%';
    } else {
      parent.style.background = '';
      parent.style.padding    = '';
    }
  }
}

/**
 * Build a non-editable widget decoration that renders the visual gap
 * (gray separator strip with an optional page number) between two pages.
 *
 * The strip is widened via negative left/right margins so that it fills the
 * full page width even though the content lives inside padded margins.
 *
 * @param pos         ProseMirror document position before which to insert.
 * @param pageNumber  The number of the page that begins *after* this break.
 * @param options     Current pagination options.
 * @param margins     Pre-resolved margin values.
 */
function buildPageBreakWidget(
  pos: number,
  pageNumber: number,
  options: PaginationOptions,
  margins: ResolvedMargins,
): Decoration {
  // Capture mutable values at call time.
  const capturedPage = pageNumber;
  const capturedOpts = options;
  const capturedMargins = margins;

  return Decoration.widget(
    pos,
    () => {
      /* ── Outer wrapper ────────────────────────────────────────────────── */
      const wrapper = document.createElement('div');
      wrapper.className        = 'page-break';
      wrapper.contentEditable  = 'false';
      wrapper.dataset.pageNumber = String(capturedPage);
      wrapper.style.cssText = [
        'display:block',
        `margin-left:-${capturedMargins.left}px`,
        `margin-right:-${capturedMargins.right}px`,
        `width:calc(100% + ${capturedMargins.left + capturedMargins.right}px)`,
        'user-select:none',
        'pointer-events:none',
        'position:relative',
      ].join(';');

      /* ── Gap strip ────────────────────────────────────────────────────── */
      const gap = document.createElement('div');
      gap.className = 'page-break__gap';
      gap.style.cssText = [
        `height:${capturedOpts.pageGap}px`,
        'background:#e8eaed',
        'border-top:1px solid #bdc1c6',
        'border-bottom:1px solid #bdc1c6',
        'display:flex',
        'align-items:center',
        'justify-content:center',
      ].join(';');

      /* ── Optional page-number label ───────────────────────────────────── */
      if (capturedOpts.showPageNumber) {
        const label = document.createElement('span');
        label.className  = 'page-break__label';
        label.textContent = `${capturedOpts.label || 'Page'} ${capturedPage}`;
        label.style.cssText = [
          'font-size:11px',
          'line-height:1',
          'color:#5f6368',
          'font-family:Arial,Helvetica,sans-serif',
          'background:#e8eaed',
          'padding:0 8px',
          'user-select:none',
          'pointer-events:none',
        ].join(';');
        gap.appendChild(label);
      }

      wrapper.appendChild(gap);
      return wrapper;
    },
    // side: -1 places the widget before the node at `pos`, ensuring the gap
    // appears between the last block of the previous page and the first block
    // of the new page.
    { side: -1 },
  );
}
