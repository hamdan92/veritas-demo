# VerITAS Demo

A demonstration of **VerITAS: Verifying Image Transformations at Scale** - a zero-knowledge proof system for image editing verification.

Based on the paper by Trisha Datta, Binyi Chen, and Dan Boneh (Stanford University, 2024).

## Overview

VerITAS proves that an edited photo was derived from a C2PA-signed original via authorized transformations (crop, blur, resize, grayscale) using zk-SNARKs. This demo showcases:

- **Real ZK Proofs**: Uses Plonky2 (PLONK + FRI) for proof generation
- **Image Transformations**: Crop, grayscale, blur, and resize operations
- **Interactive Demo**: Web interface showing each step of the protocol
- **Technical Details**: Displays proof sizes, timing, and circuit information

## Architecture

```
verti/
├── backend/          # Rust API server with Plonky2
│   ├── src/
│   │   ├── main.rs         # Actix-web server
│   │   ├── api/            # HTTP handlers
│   │   ├── image_io.rs     # Image processing
│   │   ├── jobs.rs         # Async job handling
│   │   └── veritas/        # Proof generation
│   └── Dockerfile
├── frontend/         # Next.js demo interface
│   ├── src/
│   │   ├── app/            # Pages
│   │   └── components/     # UI components
│   └── Dockerfile
└── README.md
```

## Local Development

### Prerequisites

- Rust (nightly toolchain)
- Node.js 20+
- npm

### Backend

```bash
cd backend
rustup override set nightly
cargo run --release
```

The API will be available at `http://localhost:8080`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/edit` | POST | Create an edit job with proof generation |
| `/api/job/{id}` | GET | Get job status and results |
| `/api/verify` | POST | Verify a proof |
| `/api/demo/info` | GET | Get demo information |

## Deploy to Railway

### Backend

1. Create a new service from the `backend/` directory
2. Set build command: `cargo build --release`
3. Set start command: `./target/release/server`
4. Ensure nightly Rust is used (via `rust-toolchain.toml`)

### Frontend

1. Create a new service from the `frontend/` directory
2. Set environment variable: `NEXT_PUBLIC_API_URL=<backend-url>`
3. Railway will auto-detect Next.js

## Technical Details

### Proof System

- **Plonky2**: PLONK proof system with FRI polynomial commitment
- **Field**: Goldilocks (64-bit prime)
- **Hash**: Lattice + Poseidon composition
- **Security**: ~100 bits

### Supported Edits

| Edit | Description | Circuit |
|------|-------------|---------|
| Crop | Extract rectangular region | Public inputs are cropped pixels |
| Grayscale | Convert using Photoshop formula | Prove 100*gray = 30R + 59G + 11B |
| Blur | 3x3 box blur | Range proofs for remainders |
| Resize | Bilinear interpolation | Weighted sum constraints |

## References

- [VerITAS Paper](https://github.com/zk-VerITAS/VerITAS)
- [Plonky2](https://github.com/0xPolygonZero/plonky2)
- [C2PA Standard](https://c2pa.org/)

## License

This is a demonstration project for educational purposes.
