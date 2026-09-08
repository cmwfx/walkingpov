# CandidFan temporary RunPod backlog processor

This worker is for backlog processing only. The storage VPS worker remains the local production processor and claims only jobs assigned to the `local` pool. This runner claims only jobs assigned to the `remote` pool.

The runner detects the available vCPUs with Node's `availableParallelism()`. By default, each FFmpeg encode receives up to four threads and the runner starts `vCPUs / 4` independent processing loops. A 32-vCPU CPU pod therefore defaults to eight concurrent encodes while using the full CPU budget. This hybrid is a better starting point for 720p x264 backlog work than either one giant encode or 32 one-thread processes. `FFMPEG_THREADS` and `PROCESS_CONCURRENCY` can be tuned after a real-pod benchmark.

## When a pod is rented

1. Generate a separate RSA PEM SSH key pair for the pod-to-storage SFTP connection (`ssh-keygen -t rsa -b 4096 -m PEM`). Keep the private key only on the temporary pod. The RunPod Ed25519 key used to administer the pod is separate.
2. Run `setup-remote-processor-access.sh` on the storage VPS with the public key in `PROCESSOR_SSH_PUBLIC_KEY`. This creates a restricted SFTP-only account with read access to the private inbox and write access to the CandidFan media root.
3. Prepare `/etc/candidfan/runpod-processor.env` on the pod using `.env.example`. Set `WORKER_TOKEN`, the storage host, and the private key path.
4. Run `bootstrap.sh` with `CANDIDFAN_REPO_URL=https://github.com/cmwfx/walkingpov.git`. It installs FFmpeg/Node, installs this package, and starts the runner.
5. In the CandidFan admin import page, pause the storage worker and wait for its processing count to reach zero. Use “Assign to RunPod” to move the job to the remote pool. The pod then claims the queued items concurrently.
6. When the backlog is complete, use “Return to storage VPS” before terminating the pod. Future production scans remain local by default.

The runner transfers each source to the pod over SFTP, verifies source stability, processes it locally, uploads the private source copy and published assets back to the storage VPS, verifies uploaded sizes, and only then calls the normal CandidFan publication API. Source downloads use bounded parallel SFTP reads (`SFTP_DOWNLOAD_CONCURRENCY`, default 8, with 64 KiB chunks) because the storage VPS has one vCPU; the ssh2 default of 64 reads per connection can overload that host when several workers are active. After each item—whether successful or failed—it removes that item’s temporary source, encode, preview, and thumbnail files from the pod. It also clears stale temporary work directories when it starts after an interruption. It does not print source filenames.

Do not start this runner before a storage SFTP key has been configured. Do not commit the env file or private key.
