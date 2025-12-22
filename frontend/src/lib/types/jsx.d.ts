// JSX namespace declaration for React components
import * as React from 'react';

declare global {
  namespace JSX {
    type Element = React.ReactElement;
    interface ElementAttributesProperty {
      props: object;
    }
    interface ElementChildrenAttribute {
      children: object;
    }
    interface IntrinsicElements {
      [elemName: string]: Record<string, unknown>;
    }
  }
}

export {};