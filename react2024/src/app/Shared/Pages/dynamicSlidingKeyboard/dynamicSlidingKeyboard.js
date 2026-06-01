import React, { useState, useEffect, useRef } from "react";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";
import "./DynamicKeyboard.css";

const DynamicSlidingKeyboard = ({ touchEnabled }) => {
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [currentInput, setCurrentInput] = useState(null);
  const [keyboardBottom, setKeyboardBottom] = useState(-250);
  const [layoutName, setLayoutName] = useState("default");

  const keyboardContainerRef = useRef(null);
  const keyboardRef = useRef(null);

  const keyboardHeight = 250;

  // Enable keyboard when prop changes
  useEffect(() => {
    setEnabled(touchEnabled);
  }, [touchEnabled]);

  // When input gets focus
 const handleFocus = (e) => {
  if (!enabled) return;

  const input = e.target;

  setCurrentInput(input);
  setInputValue(input.value);
  setVisible(true);

  // Sync when typing from physical keyboard
  const syncInput = () => {
    const value = input.value;
    setInputValue(value);

    if (keyboardRef.current) {
      keyboardRef.current.setInput(value);
    }
  };

  input.addEventListener("input", syncInput);

  const rect = input.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;

  const offset =
    spaceBelow < keyboardHeight ? keyboardHeight - spaceBelow + 10 : 0;

  setKeyboardBottom(offset);

  if (spaceBelow < keyboardHeight) {
    window.scrollTo({
      top: window.scrollY + offset,
      behavior: "smooth",
    });
  }
};

  // Keyboard typing
  const handleChange = (newValue) => {
    setInputValue(newValue);

    if (currentInput) {
      const nativeInputValueSetter =
        Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        ).set;

      nativeInputValueSetter.call(currentInput, newValue);

      currentInput.dispatchEvent(
        new Event("input", { bubbles: true })
      );
    }
  };

  // Handle shift / caps
  const onKeyPress = (button) => {
    if (button === "{shift}" || button === "{lock}") {
      setLayoutName(layoutName === "default" ? "shift" : "default");
    }
  };

  // Hide keyboard if clicked outside
const handleClickOutside = (e) => {
  if (
    currentInput &&
    !currentInput.contains(e.target) &&
    !keyboardContainerRef.current?.contains(e.target)
  ) {
    currentInput.removeEventListener("input", () => {});
    setVisible(false);
    setCurrentInput(null);
  }
};
  // Attach listeners to inputs
  useEffect(() => {
    const attachListeners = () => {
      const inputs = document.querySelectorAll("input, textarea");

      inputs.forEach((el) =>
        el.addEventListener("focus", handleFocus)
      );
    };

    attachListeners();

    const observer = new MutationObserver(() => attachListeners());

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      const inputs = document.querySelectorAll("input, textarea");

      inputs.forEach((el) =>
        el.removeEventListener("focus", handleFocus)
      );

      observer.disconnect();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [currentInput, enabled]);

  // Sync keyboard input
  useEffect(() => {
    if (keyboardRef.current && currentInput) {
      keyboardRef.current.setInput(currentInput.value || "");
    }
  }, [currentInput]);

  if (!enabled) return null;

  return (
    <div
      ref={keyboardContainerRef}
      className={`dynamic-keyboard ${visible ? "slide-up" : "slide-down"}`}
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%) scale(0.8)",
        transformOrigin: "bottom center",
        width: "650px",
        bottom: keyboardBottom - (visible ? 0 : keyboardHeight),
        height: keyboardHeight,
        transition: "bottom 0.3s",
        zIndex: 9998,
      }}
    >
      <Keyboard
        keyboardRef={(r) => (keyboardRef.current = r)}
        onChange={handleChange}
        onKeyPress={onKeyPress}
        layoutName={layoutName}
        inputName={currentInput?.name || ""}
        theme="hg-theme-default hg-layout-default"
      />
    </div>
  );
};

export default DynamicSlidingKeyboard;