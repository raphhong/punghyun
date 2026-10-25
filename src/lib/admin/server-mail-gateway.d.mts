import type { ReadDependencies } from './gmail-read';
export type MailGatewayConfiguration = {
 enabled?:string; purpose?:string; account?:string; owner?:string;
 hash?:string; customerGrantHash?:string; issued?:string; expires?:string;
};
export function readServerMail(request:Request, config:MailGatewayConfiguration,
 dependencies:ReadDependencies|undefined, now?:number):Promise<Response>;
