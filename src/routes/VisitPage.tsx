import { useParams } from 'react-router-dom';

export default function VisitPage() {
  const { id } = useParams<{ id: string }>();
  
  return (
    <div>
      <h1>Visit Details</h1>
      <p>Visit ID: {id}</p>
      <p>Visit details will appear here.</p>
    </div>
  );
}
