import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { MainButton } from "../MainButton";
import { Text } from "react-native";

describe("MainButton", () => {
  it("renders correctly with children", () => {
    const { getByText } = render(
      <MainButton onPress={() => {}}>
        <Text>Click Me</Text>
      </MainButton>
    );
    expect(getByText("Click Me")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <MainButton onPress={onPressMock}>
        <Text>Click Me</Text>
      </MainButton>
    );
    fireEvent.press(getByText("Click Me"));
    expect(onPressMock).toHaveBeenCalled();
  });
});
