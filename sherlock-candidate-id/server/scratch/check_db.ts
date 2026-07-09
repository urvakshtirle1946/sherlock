import mongoose from 'mongoose';
import Session from '../src/models/Session';
import Participant from '../src/models/Participant';
import ParticipantSignal from '../src/models/ParticipantSignal';
import MonitoringEvent from '../src/models/MonitoringEvent';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:57152/'; // Use the fallback in-memory DB or URI if set

async function main() {
  // Let's check which MongoDB port is active
  // Since we fixed the port, it will connect to mongodb://127.0.0.1:27018/
  const uri = 'mongodb://127.0.0.1:27018/';
  console.log(`Connecting to ${uri}...`);
  try {
    await mongoose.connect(uri);
    console.log('Connected!');

    const sessions = await Session.find().sort({ createdAt: -1 }).limit(5);
    console.log(`\n--- Recent Sessions (Total: ${await Session.countDocuments()}) ---`);
    for (const s of sessions) {
      const pCount = await Participant.countDocuments({ sessionId: s._id });
      const sigCount = await ParticipantSignal.countDocuments({ sessionId: s._id });
      const monCount = await MonitoringEvent.countDocuments({ sessionId: s._id });
      console.log(`ID: ${s._id} | Candidate: ${s.candidateName} | Ingestion: ${s.ingestionMode} | Status: ${s.status} | BotId: ${s.recallBotId || 'none'} | Participants: ${pCount} | Signals: ${sigCount} | MonEvents: ${monCount} | Created: ${s.createdAt}`);
    }

    const participants = await Participant.find().sort({ createdAt: -1 }).limit(10);
    console.log(`\n--- Recent Participants (Total: ${await Participant.countDocuments()}) ---`);
    for (const p of participants) {
      console.log(`SessionId: ${p.sessionId} | PartId: ${p.participantId} | Name: ${p.displayName} | Email: ${p.email} | Joined: ${p.joinedAt} | Left: ${p.leftAt || 'present'}`);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
