import React from "react";
import { View, Text, ViewProps } from "react-native";

type NotPressableProps = ViewProps & {
  children?: React.ReactNode;
};

export function NotPressable({ children, ...rest }: NotPressableProps) {
  const disableSelectable = (child: React.ReactNode): React.ReactNode => {
    if (typeof child === "string" || typeof child === "number") {
      return <Text selectable={false}>{child}</Text>;
    }

    if (!React.isValidElement(child)) return child;

    const element = child as React.ReactElement<any>;

    const isText = element.type === Text;
    const newProps = isText
      ? { ...element.props, selectable: false }
      : element.props;

    const newChildren = React.Children.map(newProps.children, disableSelectable);

    return React.cloneElement(element, { ...newProps, children: newChildren });
  };

  return React.Children.map(children, disableSelectable);
}