import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { CrmSingleSelect, type CrmChoice } from "./CrmSingleSelect";
import type { CrmLanguage } from "../../utils/crmLanguage";
const text = (node: ReactNode): string => {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (isValidElement<{ children?: ReactNode }>(node))
    return text(node.props.children);
  return Children.toArray(node).map(text).join("");
};
/** Read existing option declarations without changing values, labels or disabled placeholders. */
export function crmSelectChoices(children: ReactNode): CrmChoice[] {
  const choices: CrmChoice[] = [];
  Children.forEach(children, (child) => {
    if (
      !isValidElement<{
        value?: string;
        disabled?: boolean;
        children?: ReactNode;
      }>(child)
    )
      return;
    if (child.type === Fragment)
      choices.push(...crmSelectChoices(child.props.children));
    else if (child.type === "option")
      choices.push({
        value: String(child.props.value ?? text(child.props.children)),
        label: text(child.props.children),
        disabled: child.props.disabled,
      });
  });
  return choices;
}
export function CrmSelect({
  children,
  ...props
}: {
  children: ReactNode;
  required?: boolean;
  controlId?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  lang: CrmLanguage;
  isLight: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return <CrmSingleSelect {...props} options={crmSelectChoices(children)} />;
}
