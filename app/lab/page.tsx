import { redirect } from 'next/navigation';

export default function LabPage() {
  // Redirect to the weights sandbox as the main lab page
  redirect('/lab/weights');
}
