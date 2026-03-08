import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

/**
 * Returns current keyboard height (0 when hidden).
 * Use to add extra paddingBottom to ScrollView so content can scroll above keyboard.
 */
export function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const onShow = (e: { endCoordinates: { height: number } }) =>
      setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);

    const subShow = Keyboard.addListener("keyboardDidShow", onShow);
    const subHide = Keyboard.addListener("keyboardDidHide", onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  return keyboardHeight;
}
