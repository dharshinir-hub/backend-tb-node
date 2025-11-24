import React, { useState, useEffect, useRef } from "react";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";
import "./DynamicKeyboard.css";

const DynamicSlidingKeyboard = ({ touchEnabled }) => {
  const [enabled, setEnabled] = useState(false); // Keyboard enabled/disabled
  const [visible, setVisible] = useState(false); // Keyboard visibility
  const [inputValue, setInputValue] = useState("");
  const [currentInput, setCurrentInput] = useState(null);
  const [keyboardBottom, setKeyboardBottom] = useState(-250);
  const keyboardContainerRef = useRef(null);
  const keyboardRef = useRef(null);
  const keyboardHeight = 250;

  // Update `enabled` whenever the prop changes
  useEffect(() => {
    setEnabled(touchEnabled);
  }, [touchEnabled]);

  const handleFocus = (e) => {
    if (!enabled) return;
    setCurrentInput(e.target);
    setInputValue(e.target.value);
    setVisible(true);

    const rect = e.target.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const offset = spaceBelow < keyboardHeight ? keyboardHeight - spaceBelow + 10 : 0;
    setKeyboardBottom(offset);

    if (spaceBelow < keyboardHeight) {
      window.scrollTo({
        top: window.scrollY + offset,
        behavior: "smooth",
      });
    }
  };

  const handleChange = (newValue) => {
    setInputValue(newValue);
    if (currentInput) currentInput.value = newValue;
  };

  const handleClickOutside = (e) => {
    if (
      currentInput &&
      !currentInput.contains(e.target) &&
      !keyboardContainerRef.current?.contains(e.target)
    ) {
      setVisible(false);
      setCurrentInput(null);
    }
  };

  useEffect(() => {
    const attachListeners = () => {
      const inputs = document.querySelectorAll("input, textarea");
      inputs.forEach((el) => el.addEventListener("focus", handleFocus));
    };

    attachListeners();

    const observer = new MutationObserver(() => attachListeners());
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      const inputs = document.querySelectorAll("input, textarea");
      inputs.forEach((el) => el.removeEventListener("focus", handleFocus));
      observer.disconnect();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [currentInput, enabled]);

  useEffect(() => {
    if (keyboardRef.current && currentInput) {
      keyboardRef.current.setInput(currentInput.value || "");
    }
  }, [currentInput]);

  if (!enabled) return null; // Do not render keyboard at all if not enabled

  return (
    <div
      ref={keyboardContainerRef}
      className={`dynamic-keyboard ${visible ? "slide-up" : "slide-down"}`}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: keyboardBottom - (visible ? 0 : keyboardHeight),
        height: keyboardHeight,
        transition: "bottom 0.3s",
        zIndex: 9998,
      }}
    >
      <Keyboard
        keyboardRef={(r) => (keyboardRef.current = r)}
        onChange={handleChange}
        inputName={currentInput?.name || ""}
        theme="hg-theme-default hg-layout-default"
      />
    </div>
  );
};

export default DynamicSlidingKeyboard;
