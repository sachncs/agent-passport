import algosdk from 'algosdk';
import { config } from '../config';

export const algod = new algosdk.Algodv2(config.algodToken, config.algodUrl);
