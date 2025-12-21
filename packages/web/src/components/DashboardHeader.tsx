/**
 * Dashboard Header Component
 * Navigation header with ChatBB link
 */

export default function DashboardHeader() {
  return (
    <header className="border-b border-gray-200 bg-white shadow-sm">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <div>
          <h1 className="text-2xl font-bold text-green-700">
            Biodiversidade do Brasil
          </h1>
          <p className="text-sm text-gray-600">
            Analítica e exploração de dados
          </p>
        </div>

        <nav className="flex items-center gap-4">
          <a
            href="/chat"
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white transition-all hover:bg-green-700"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span>ChatBB</span>
          </a>

          <a
            href="/api/docs"
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-all hover:bg-gray-50"
          >
            API Docs
          </a>
        </nav>
      </div>
    </header>
  )
}
