import * as React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SelectOption = {
  value: string;
  label: React.ReactNode;
};

type ResponsiveSelectProps = {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function ResponsiveSelect({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  className,
  disabled = false,
}: ResponsiveSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const isMobile = useIsMobile();

  const selectedOption = options.find((option) => option.value === value);

  const handleSelect = (currentValue: string) => {
    onChange(currentValue);
    setIsOpen(false);
  };

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button
            variant="outline"
            className={cn('w-full justify-between', className)}
            disabled={disabled}
          >
            <span className="truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <div className="mt-4 border-t">
            <OptionList options={options} onSelect={handleSelect} value={value} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className={cn('w-full justify-between', className)}
          disabled={disabled}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <OptionList options={options} onSelect={handleSelect} value={value} />
      </PopoverContent>
    </Popover>
  );
}

function OptionList({
  options,
  onSelect,
  value,
}: {
  options: SelectOption[];
  onSelect: (value: string) => void;
  value?: string;
}) {
  return (
    <Command>
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup>
          {options.map((option) => (
            <CommandItem
              key={option.value}
              value={typeof option.label === 'string' ? option.label : option.value}
              onSelect={() => onSelect(option.value)}
            >
              <Check
                className={cn(
                  'mr-2 h-4 w-4',
                  value === option.value ? 'opacity-100' : 'opacity-0'
                )}
              />
              {option.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}