import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-4xl font-bold">404 - Not Found</h1>
      <p className="text-lg">The page you are looking for does not exist.</p>
      <Link href="/">
        <a className="text-blue-500 hover:underline">Go back to the dashboard</a>
      </Link>
    </div>
  );
}
