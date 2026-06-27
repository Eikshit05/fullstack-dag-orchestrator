import { TextField } from './TextField';
import { TextAreaField } from './TextAreaField';
import { SelectField } from './SelectField';
import { NumberField } from './NumberField';
import { CheckboxField } from './CheckboxField';
import { PasswordField } from './PasswordField';
import { SchemaField } from './SchemaField';

export const FIELD_COMPONENTS = {
  text: TextField,
  textarea: TextAreaField,
  select: SelectField,
  number: NumberField,
  checkbox: CheckboxField,
  password: PasswordField,
  schema: SchemaField,
};
