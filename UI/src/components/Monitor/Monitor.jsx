import { useEffect, useState } from 'react';
import { Table, Button, Stack, Badge } from 'react-bootstrap';
import { io } from 'socket.io-client';

export default function Monitor() {
  const [steps, setSteps] = useState([]);
  const [status, setStatus] = useState('running'); // running / paused
  const socket = io('ws://localhost:8081');

  useEffect(() => {
    socket.on('step',  d => setSteps(s => [...s, d]));
    socket.on('error', d => setSteps(s => [...s, { ...d, status: 'error' }]));
    socket.on('log',   d => console.log(d));

    return () => socket.disconnect();
  }, []);

  const send = (cmd) => socket.emit(cmd);

  return (
    <div className="p-3">
      <h4 className="mb-3">Live Monitor</h4>

      <Stack direction="horizontal" gap={2} className="mb-3">
        <Button size="sm" onClick={() => { send('pause'); setStatus('paused'); }}>
          Pause
        </Button>
        <Button size="sm" onClick={() => { send('resume'); setStatus('running'); }}>
          Resume
        </Button>
        <Button size="sm" variant="danger" onClick={() => send('stop')}>
          Stop
        </Button>
        <Badge bg={status === 'paused' ? 'warning' : 'success'}>
          {status}
        </Badge>
      </Stack>

      <Table bordered size="sm" responsive>
        <thead>
          <tr>
            <th>#</th>
            <th>Account</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s, i) => (
            <tr key={i}>
              <td>{s.idx}</td>
              <td>{s.account || '-'}</td>
              <td>{s.status}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
