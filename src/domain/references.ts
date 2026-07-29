import { LoreError, ERROR_CODES } from './errors.js';
import type { RecordKind } from './types.js';
export interface ParsedRecordReference { repositoryId:string; kind:RecordKind; id:string; revision:number }
export function recordReference(repositoryId:string,record:{id:string;kind:RecordKind;revision:number}):string{return `lore://${repositoryId}/${record.kind}/${record.id}@${record.revision}`}
export function parseRecordReference(value:string):ParsedRecordReference{const m=/^lore:\/\/([a-z0-9.-]+)\/(repository|component|relationship|decision|finding|constraint|procedure)\/([a-z0-9.-]+)@(\d+)$/.exec(value);if(!m)throw new LoreError({code:ERROR_CODES.INVALID_RECORD_REFERENCE,message:`INVALID_RECORD_REFERENCE: ${value}`});return{repositoryId:m[1]!,kind:m[2] as RecordKind,id:m[3]!,revision:Number(m[4])}}
