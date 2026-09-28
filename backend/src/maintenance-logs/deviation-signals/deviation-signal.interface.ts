export type DeviationSignalValueType = 'number' | 'boolean';

export interface DeviationSignal<TPayload> {
  key: string;
  label: string;
  valueType: DeviationSignalValueType;
  compute: (payload: TPayload) => number | boolean | null;
}
