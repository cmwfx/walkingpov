import 'dotenv/config';
import { startEmailWorker } from './services/email.js';

console.log('CandidFan email worker started');
startEmailWorker();
