declare module 'next' {
  export type Metadata = any;
  export type Viewport = any;
  export type ResolvingMetadata = any;
  export type ResolvingViewport = any;
  const next: any;
  export default next;
}

declare module 'next/link' {
  import React from 'react';
  export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string | any;
    as?: string | any;
    replace?: boolean;
    scroll?: boolean;
    shallow?: boolean;
    passHref?: boolean;
    prefetch?: boolean;
  }
  const Link: React.ForwardRefExoticComponent<LinkProps & React.RefAttributes<HTMLAnchorElement>>;
  export default Link;
}

declare module 'next/navigation' {
  export function usePathname(): string;
  export function useRouter(): any;
  export function useSearchParams(): URLSearchParams;
  export function useParams(): any;
  export function redirect(url: string): never;
  export function notFound(): never;
}

declare module 'next/types.js' {
  export type Metadata = any;
  export type Viewport = any;
  export type ResolvingMetadata = any;
  export type ResolvingViewport = any;
}

declare module 'next/dist/lib/metadata/types/metadata-interface.js' {
  export type ResolvingMetadata = any;
  export type ResolvingViewport = any;
}

declare module 'next/dist/lib/metadata/types/metadata-types.js' {
  export type Metadata = any;
}
