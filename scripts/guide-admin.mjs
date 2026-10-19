import { readFile } from 'node:fs/promises';
import { sign, createPublicKey } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import admin from '../config/guide-admin.json' with {type:'json'};
import { guideResetMessage } from '../server/guide-api.mjs';

const defaultKey=fileURLToPath(new URL('../.cat-monitor/guide-admin-key.pem',import.meta.url));
export async function signGuideReset(home,role,input,{keyFile=defaultKey}={}) {
  const privateKey=await readFile(keyFile,'utf8');
  if(createPublicKey(privateKey).export({type:'spki',format:'pem'})!==admin.publicKey)throw Error('Local guide signing key does not match');
  return {...input,signature:sign(null,Buffer.from(guideResetMessage(home,role,input)),privateKey).toString('base64')};
}
export async function guideAdminReady({keyFile=defaultKey}={}) {
  try {const key=await readFile(keyFile,'utf8');return createPublicKey(key).export({type:'spki',format:'pem'})===admin.publicKey;}catch{return false;}
}
