import { TextField } from './TextField';
import { TextAreaField } from './TextAreaField';
import { SelectField } from './SelectField';
import { NumberField } from './NumberField';
import { CheckboxField } from './CheckboxField';
import { SchemaField } from './SchemaField';
import { ProviderModelField } from './ProviderModelField';

export const FIELD_COMPONENTS = {
  text: TextField,
  textarea: TextAreaField,
  select: SelectField,
  number: NumberField,
  checkbox: CheckboxField,
  schema: SchemaField,
  providerModel: ProviderModelField,
};
