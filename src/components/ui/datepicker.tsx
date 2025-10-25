"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { FormControl } from "@/components/ui/form"

interface DatePickerProps {
  value?: Date | null;
  onChange: (date?: Date) => void;
  disabled?: boolean;
}

export function DatePicker({ value, onChange, disabled }: DatePickerProps) {
  const [inputValue, setInputValue] = React.useState<string>(value ? format(value, "yyyy-MM-dd") : "");

  React.useEffect(() => {
    if (value) {
      setInputValue(format(value, "yyyy-MM-dd"));
    } else {
      setInputValue("");
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newInputValue = e.target.value;
    setInputValue(newInputValue);
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(newInputValue)) {
      const parsedDate = parse(newInputValue, "yyyy-MM-dd", new Date());
      if (isValid(parsedDate)) {
        onChange(parsedDate);
      }
    }
  };

  const handleDateSelect = (date?: Date) => {
    onChange(date);
    if (date) {
      setInputValue(format(date, "yyyy-MM-dd"));
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <FormControl>
          <Button
            variant={"outline"}
            className={cn(
              "w-full pl-3 text-left font-normal",
              !value && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            {value ? (
              format(value, "PPP")
            ) : (
              <span>Pick a date</span>
            )}
            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
          </Button>
        </FormControl>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-2">
          <Input
            type="text"
            placeholder="YYYY-MM-DD"
            value={inputValue}
            onChange={handleInputChange}
          />
        </div>
        <Calendar
          mode="single"
          selected={value || undefined}
          onSelect={handleDateSelect}
          initialFocus={false}
          defaultMonth={value || undefined}
        />
      </PopoverContent>
    </Popover>
  )
}