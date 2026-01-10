import './setupTests'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UploadPage from '../pages/upload'

describe('Upload page', () => {
  beforeEach(() => {
    // mock fetch globally
    // @ts-ignore - attach to global
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, documentId: 'doc-123' }) }),
    )
  })

  afterEach(() => {
    // @ts-ignore
    vi.resetAllMocks()
  })

  it('renders and performs upload', async () => {
    render(<UploadPage />)

    // project id input
    const projectInput = screen.getByLabelText(/Project ID/i) as HTMLInputElement
    await userEvent.clear(projectInput)
    await userEvent.type(projectInput, 'test-project')
    expect(projectInput.value).toBe('test-project')

    // file input
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' })
    const fileInput = screen.getByLabelText(/File/i) as HTMLInputElement
    // Simulate file selection
    await userEvent.upload(fileInput, file)
    expect(fileInput.files && fileInput.files[0].name).toBe('test.txt')

    // submit
    const button = screen.getByRole('button', { name: /upload/i })
    await userEvent.click(button)

    // wait for success message
    await waitFor(() => expect(screen.getByText(/Upload successful/i)).toBeInTheDocument())

    // verify fetch called
    // @ts-ignore
    expect(global.fetch).toHaveBeenCalledTimes(1)
    // inspect fetch call to ensure FormData was sent
    // (We can't read FormData easily here, but the call occurred.)
  })
})
