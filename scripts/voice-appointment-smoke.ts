import { detectAudioType, MAX_INBOUND_AUDIO_BYTES } from '../server/voiceMessages';
import { canTransitionAppointmentStatus, validateAppointmentInput } from '../server/inputValidation';

let passed = 0;
let failed = 0;
function assert(condition: boolean, label: string) {
  if (condition) passed++;
  else {
    failed++;
    console.error('FAIL:', label);
  }
}

const wav = Buffer.alloc(12);
wav.write('RIFF', 0, 'ascii');
wav.write('WAVE', 8, 'ascii');
const ogg = Buffer.from('OggS-test');
const invalid = Buffer.from('not-audio');
assert(detectAudioType(wav)?.mime === 'audio/wav', 'detects WAV audio');
assert(detectAudioType(ogg)?.mime === 'audio/ogg', 'detects OGG audio');
assert(detectAudioType(invalid) === null, 'rejects unsupported audio bytes');
assert(detectAudioType(Buffer.alloc(MAX_INBOUND_AUDIO_BYTES + 1)) === null, 'rejects oversized audio');

const start = new Date(Date.now() + 2 * 60 * 60 * 1000);
const end = new Date(start.getTime() + 60 * 60 * 1000);
const valid = validateAppointmentInput({
  customerName: 'Rafi',
  customerPhone: '+8801700000000',
  service: 'Consultation',
  startsAt: start.toISOString(),
  endsAt: end.toISOString(),
  advanceAmount: '500',
  advancePaymentMethod: 'bKash',
  advanceTransactionId: 'TX-123',
});
assert(valid?.advanceAmount === 500 && valid.service === 'Consultation', 'validates appointment and advance payment');
assert(validateAppointmentInput({ customerName: 'Rafi', service: 'Consultation', startsAt: end.toISOString(), endsAt: start.toISOString() }) === null, 'rejects inverted appointment times');
assert(validateAppointmentInput({ customerName: 'Rafi', service: 'Consultation', startsAt: start.toISOString(), endsAt: end.toISOString(), advanceAmount: -1 }) === null, 'rejects negative advance payment');
assert(validateAppointmentInput({ customerName: '', service: 'Consultation', startsAt: start.toISOString(), endsAt: end.toISOString() }) === null, 'rejects missing customer name');
assert(validateAppointmentInput({ customerName: 'Rafi', service: 'Consultation', startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 25 * 60 * 60 * 1000).toISOString() }) === null, 'rejects appointments longer than one day');
assert(canTransitionAppointmentStatus('REQUESTED', 'CONFIRMED'), 'allows request confirmation');
assert(canTransitionAppointmentStatus('CONFIRMED', 'COMPLETED'), 'allows completion after confirmation');
assert(!canTransitionAppointmentStatus('COMPLETED', 'CONFIRMED'), 'does not reopen completed appointments');

console.log(`\nVoice and appointment smoke tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
