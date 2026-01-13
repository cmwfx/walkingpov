import { useRef, useState, type KeyboardEvent, type ClipboardEvent } from 'react';
import { Input } from '@/components/ui/input';

interface CodeInputProps {
  length?: number;
  onComplete: (code: string) => void;
  disabled?: boolean;
}

export function CodeInput({ length = 6, onComplete, disabled = false }: CodeInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    const sanitized = value.replace(/[^0-9]/g, '');
    
    if (sanitized.length === 0) {
      // Handle deletion
      const newValues = [...values];
      newValues[index] = '';
      setValues(newValues);
      return;
    }

    // If pasting multiple digits
    if (sanitized.length > 1) {
      handlePaste(sanitized, index);
      return;
    }

    // Single digit input
    const newValues = [...values];
    newValues[index] = sanitized;
    setValues(newValues);

    // Auto-focus next input
    if (index < length - 1 && sanitized) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if complete
    const newCode = [...newValues];
    if (newCode.every(v => v !== '') && index === length - 1) {
      onComplete(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !values[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (pastedData: string, startIndex: number = 0) => {
    const digits = pastedData.replace(/[^0-9]/g, '').slice(0, length);
    const newValues = [...values];
    
    for (let i = 0; i < digits.length; i++) {
      if (startIndex + i < length) {
        newValues[startIndex + i] = digits[i];
      }
    }
    
    setValues(newValues);

    // Focus last filled input or next empty one
    const lastIndex = Math.min(startIndex + digits.length, length - 1);
    inputRefs.current[lastIndex]?.focus();

    // Check if complete
    if (newValues.every(v => v !== '')) {
      onComplete(newValues.join(''));
    }
  };

  const handlePasteEvent = (e: ClipboardEvent<HTMLInputElement>, index: number) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    handlePaste(pastedData, index);
  };

  const handleFocus = (index: number) => {
    // Select the content when focused
    inputRefs.current[index]?.select();
  };

  return (
    <div className="flex gap-1 sm:gap-2 justify-center max-w-full">
      {Array.from({ length }, (_, index) => (
        <Input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={values[index]}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={(e) => handlePasteEvent(e, index)}
          onFocus={() => handleFocus(index)}
          disabled={disabled}
          className="w-8 sm:w-12 h-12 sm:h-14 text-center text-lg sm:text-2xl font-bold flex-shrink-0"
          autoComplete="off"
          autoFocus={index === 0}
        />
      ))}
    </div>
  );
}
