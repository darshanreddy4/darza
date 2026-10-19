"use client";

import { Children, Fragment, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { Dropdown, type DropdownGroup, type DropdownOption } from "./Dropdown";

export interface SelectChange { target: { value: string; name: string }; currentTarget: { value: string; name: string } }

type NativeProps = Omit<ComponentProps<"select">, "onChange" | "value" | "defaultValue" | "children" | "className" | "multiple" | "size">;
interface Props extends NativeProps {
  value?: string | number;
  defaultValue?: string | number;
  className?: string;
  onChange?: (e: SelectChange) => void;
  children: ReactNode;
}

const text = (node: ReactNode) => Children.toArray(node).map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : "")).join("");

function toOption(el: ReactElement<ComponentProps<"option">>): DropdownOption {
  const label = text(el.props.children);
  return { value: el.props.value === undefined ? label : String(el.props.value), label, disabled: el.props.disabled };
}

// Reads option and optgroup children (also through fragments and .map() lists) into the dropdown's groups.
function toGroups(children: ReactNode): DropdownGroup[] {
  const groups: DropdownGroup[] = [];
  let loose: DropdownOption[] = [];
  const flush = () => { if (loose.length) groups.push({ options: loose }); loose = []; };
  const walk = (nodes: ReactNode) => Children.forEach(nodes, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ children?: ReactNode; label?: string }>;
    if (el.type === Fragment) walk(el.props.children);
    else if (el.type === "option") loose.push(toOption(el as ReactElement<ComponentProps<"option">>));
    else if (el.type === "optgroup") {
      flush();
      const options: DropdownOption[] = [];
      Children.forEach(el.props.children, (o) => { if (isValidElement(o) && o.type === "option") options.push(toOption(o as ReactElement<ComponentProps<"option">>)); });
      groups.push({ label: el.props.label, options });
    }
  });
  walk(children);
  flush();
  return groups;
}

// A drop-in replacement for a native select: the same props and <option> children, but it opens as the site's tidy dropdown list.
export function Select({ value, defaultValue, className = "", onChange, children, name, "aria-label": ariaLabel, ...rest }: Props) {
  const auto = /(^|\s)!?w-auto(\s|$)/.test(className);
  return (
    <Dropdown
      field label={ariaLabel} name={name} id={rest.id} title={rest.title} required={rest.required} disabled={rest.disabled} autoComplete={rest.autoComplete}
      value={value === undefined ? undefined : String(value)} defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
      groups={toGroups(children)}
      onChange={(v) => onChange?.({ target: { value: v, name: name ?? "" }, currentTarget: { value: v, name: name ?? "" } })}
      className={auto ? "inline-block" : "block w-full"} buttonClassName={className}
    />
  );
}
