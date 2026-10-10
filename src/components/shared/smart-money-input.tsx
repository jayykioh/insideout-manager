import React, { useState, InputHTMLAttributes, useEffect, useRef } from "react";
import { money } from "@/lib/domain";

interface SmartMoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string | number;
  defaultValue?: string | number;
  onValueChange?: (val: string) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  maxAmount?: number;
}

export function SmartMoneyInput({ value, defaultValue, onValueChange, onChange, maxAmount, style, className, ...props }: SmartMoneyInputProps) {
  const [internalVal, setInternalVal] = useState(value ?? defaultValue ?? "");
  const [focused, setFocused] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputVal = !focused && value !== undefined ? value : internalVal;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setInternalVal(newVal); // Update UI instantly
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Create a synthetic event clone if onChange needs to be called later
    let eClone: React.ChangeEvent<HTMLInputElement> | null = null;
    if (onChange) {
      eClone = {
        ...e,
        target: { ...e.target, value: newVal, name: props.name },
        currentTarget: { ...e.currentTarget, value: newVal, name: props.name },
      } as React.ChangeEvent<HTMLInputElement>;
    }

    timeoutRef.current = setTimeout(() => {
      if (onValueChange) onValueChange(newVal);
      if (onChange && eClone) onChange(eClone);
    }, 250); // Debounce by 250ms for smooth typing performance
  };
  
  const setVal = (newVal: string) => {
    setInternalVal(newVal); // Update UI instantly
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Immediate update when selecting a suggestion
    if (onValueChange) onValueChange(newVal);
    if (onChange) {
      const e = { target: { value: newVal, name: props.name } } as React.ChangeEvent<HTMLInputElement>;
      onChange(e);
    }
  };

  const valNum = Number(inputVal);
  const recommendations: number[] = [];
  
  if (valNum > 0 && valNum < 10000 && Number.isInteger(valNum)) {
    const scales = [1000, 10000, 100000];
    for (const scale of scales) {
      const suggested = valNum * scale;
      if (suggested <= (maxAmount ?? 1000000000)) {
        recommendations.push(suggested);
      }
    }
  }

  useEffect(() => {
    const handleClick = () => {
      setFocused(false);
    };
    if (focused) {
      document.addEventListener("click", handleClick);
    }
    return () => document.removeEventListener("click", handleClick);
  }, [focused]);

  return (
    <div style={{ position: "relative", width: "100%" }} className={className} onClick={(e) => e.stopPropagation()}>
      <input
        {...props}
        value={inputVal}
        onChange={handleChange}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        style={{ width: "100%", ...style }}
      />
      {focused && recommendations.length > 0 && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          marginTop: "4px",
          display: "flex",
          gap: "6px",
          flexWrap: "wrap",
          zIndex: 50,
          background: "var(--surface)",
          padding: "6px",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          width: "100%"
        }}>
          {recommendations.map(r => (
            <button
              key={r}
              type="button"
              className="text-button"
              style={{
                fontSize: "13px",
                padding: "8px",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                flex: "1 1 auto",
                textAlign: "center",
                fontWeight: 500,
                color: "var(--text)",
                justifyContent: "center"
              }}
              onMouseDown={(e) => {
                e.preventDefault(); 
              }}
              onClick={() => {
                setVal(String(r));
                setFocused(false);
              }}
            >
              {money(r)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
