// Module declarations for packages that may not ship types or are optional
declare module "xlsx" {
  interface XLSXUtils {
    json_to_sheet: (data: unknown[]) => unknown;
    book_new: () => unknown;
    book_append_sheet: (wb: unknown, ws: unknown, name?: string) => void;
    aoa_to_sheet?: (data: unknown[][]) => unknown;
  }
  interface XLSXStatic {
    utils: XLSXUtils;
    writeFile: (wb: unknown, name: string, opts?: unknown) => void;
  }
  const xlsx: XLSXStatic;
  export = xlsx;
}
declare module "vaul" {
  import * as React from "react";
  export const Drawer: {
    Root: React.ComponentType<Record<string, unknown>>;
    Trigger: React.ComponentType<Record<string, unknown>>;
    Portal: React.ComponentType<Record<string, unknown>>;
    Close: React.ComponentType<Record<string, unknown>>;
    Content: React.ComponentType<Record<string, unknown>>;
    Overlay: React.ComponentType<Record<string, unknown>>;
    Header: React.ComponentType<Record<string, unknown>>;
    Footer: React.ComponentType<Record<string, unknown>>;
    Title: React.ComponentType<Record<string, unknown>>;
    Description: React.ComponentType<Record<string, unknown>>;
  };
}
