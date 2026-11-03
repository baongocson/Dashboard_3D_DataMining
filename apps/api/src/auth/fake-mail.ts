// Explicit development/test adapter. No network and no HTTP inspection endpoint.
export class FakeMailAdapter {
  readonly kind='fake-local';
  readonly messages:{email:string;challengeId:string;purpose:string;generation:number;otp:string}[]=[];
  nextStatus:'accepted'|'failed'|'unknown'='accepted';
  async send(message:typeof this.messages[number]) {
    this.messages.push({...message});const status=this.nextStatus;this.nextStatus='accepted';return status;
  }
}
