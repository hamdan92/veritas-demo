'use client';

import { useState } from 'react';

export default function HowItWorks() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const sections = [
    {
      id: 'camera',
      question: 'How does the verifier know the image came from a real camera?',
      icon: '📷',
      shortAnswer: 'Digital signature + image fingerprint that only the camera can create',
      details: [
        {
          title: 'The Camera Has a Secret Key',
          content: 'Every camera (or signing device) has a unique private key stored securely in hardware. This key NEVER leaves the device. It\'s like a unique fingerprint that only this specific camera has.'
        },
        {
          title: 'Creating the Image Fingerprint',
          content: 'When a photo is taken, the camera computes a "hash" of all the pixels. A hash is like a unique fingerprint - even changing ONE pixel would create a completely different hash. We use Poseidon hash (ZK-friendly) or SHA-256.'
        },
        {
          title: 'Signing the Fingerprint',
          content: 'The camera uses its secret key to create a digital signature on the hash. This signature mathematically proves: "A device with this specific private key vouches that this exact image existed at this moment."'
        },
        {
          title: 'Why Can\'t This Be Faked?',
          content: 'Without the camera\'s secret key, it\'s mathematically impossible to create a valid signature. If someone modifies even one pixel, the hash changes, and the old signature becomes invalid. The attacker would need the camera\'s secret key to sign the new hash - which they don\'t have.'
        },
        {
          title: 'What the Verifier Checks',
          content: '1) Compute the hash of the image independently\n2) Use the camera\'s PUBLIC key (published/known) to verify the signature\n3) If the signature is valid for this hash, the image is authentic'
        }
      ]
    },
    {
      id: 'modification',
      question: 'How does the verifier know a specific modification was made?',
      icon: '✏️',
      shortAnswer: 'Zero-Knowledge Proof that mathematically proves: edited = transform(original)',
      details: [
        {
          title: 'The Mathematical Claim',
          content: 'The editor claims: "I took the original image O and applied transformation T to get edited image E." In math: E = T(O). For example, for grayscale: E[i] = (R[i] + G[i] + B[i]) / 3 for each pixel.'
        },
        {
          title: 'What is a Zero-Knowledge Proof?',
          content: 'A ZK proof lets you prove a statement is TRUE without revealing the underlying data. Here, we prove "E = T(O)" without showing O. The verifier learns ONLY that the transformation was applied correctly - nothing about the original image.'
        },
        {
          title: 'Building the Circuit',
          content: 'We convert the transformation into an "arithmetic circuit" - a series of mathematical operations (add, multiply). For grayscale: each output pixel = (R + G + B) / 3. Plonky2 encodes this as polynomial constraints.'
        },
        {
          title: 'Generating the Proof',
          content: 'The prover (editor) runs the circuit with actual pixel values and generates a proof. This proof is ~145KB and contains polynomial commitments that encode the computation without revealing inputs.'
        },
        {
          title: 'What the Verifier Checks',
          content: '1) The proof is mathematically valid (polynomial checks)\n2) The claimed transformation matches the circuit\n3) The output matches the edited image shown\n\nIf all checks pass, we KNOW the edit was applied correctly.'
        }
      ]
    },
    {
      id: 'hidden',
      question: 'How does the verifier know no additional/hidden edits were made?',
      icon: '🔒',
      shortAnswer: 'The proof is ONLY valid for the exact computation - any different edit = different proof',
      details: [
        {
          title: 'Soundness Property',
          content: 'ZK-SNARKs have a property called "soundness": it\'s computationally impossible to create a valid proof for a FALSE statement. If the editor made ANY different edit, they cannot produce a valid proof claiming they only did grayscale.'
        },
        {
          title: 'The Circuit is Fixed',
          content: 'The circuit defines EXACTLY what transformation is being proven. A grayscale circuit ONLY proves grayscale. If someone secretly added a watermark or changed pixels beyond the claimed edit, the circuit wouldn\'t match and no valid proof exists.'
        },
        {
          title: 'Binding to Original Hash',
          content: 'The proof includes a commitment to the original image\'s hash (from the camera signature). This binds the proof to a SPECIFIC original. You can\'t prove a transformation from a different starting image.'
        },
        {
          title: 'Mathematical Guarantee',
          content: 'The probability of creating a fake proof is approximately 1 in 2^100 (security parameter). This is smaller than the chance of randomly guessing a 256-bit key. For practical purposes, it\'s impossible.'
        },
        {
          title: 'What This Means',
          content: 'If the proof verifies:\n✓ Original image matches camera signature\n✓ Edit is EXACTLY as claimed (grayscale, crop, etc.)\n✓ NO other modifications possible\n\nAny hidden edit would require a different proof that the editor cannot create.'
        }
      ]
    },
    {
      id: 'claim',
      question: 'Where does the verifier get the editor\'s claim about the edit?',
      icon: '📦',
      shortAnswer: 'The claim is bundled WITH the proof - the proof only works for that specific claim',
      details: [
        {
          title: 'The Editor Provides a Package',
          content: 'When an editor shares a verified image, they provide a BUNDLE containing:\n• The edited image (pixels)\n• The claim: "I applied [grayscale/crop/blur/etc.]"\n• The ZK proof\n• Reference to the original\'s signature'
        },
        {
          title: 'The Claim is Explicit',
          content: 'The editor MUST state what transformation they claim to have done. They can\'t just say "I edited it" - they must specify: "I converted to grayscale" or "I cropped region (x,y,w,h)" etc.'
        },
        {
          title: 'The Proof is Claim-Specific',
          content: 'Here\'s the key insight: A ZK proof for "grayscale" is DIFFERENT from a proof for "crop". The proof circuit is built specifically for the claimed transformation. You cannot use a grayscale proof to verify a crop claim.'
        },
        {
          title: 'What If the Editor Lies About the Claim?',
          content: 'If the editor claims "grayscale" but actually did something else:\n• The proof will FAIL verification\n• The grayscale circuit checks: output[i] = (R[i]+G[i]+B[i])/3\n• If the actual edit was different, this equation won\'t hold\n• No valid proof can be generated for a false claim'
        },
        {
          title: 'In Practice: C2PA Metadata',
          content: 'In real-world implementations (like C2PA/Content Credentials), this bundle is embedded as metadata INSIDE the image file - similar to EXIF data. When you open the image, software can read and verify the embedded claims and proofs automatically.'
        }
      ]
    },
    {
      id: 'chain',
      question: 'How does the complete chain of custody work?',
      icon: '🔗',
      shortAnswer: 'Camera signature → Original hash → Edit proof → Edited image (all cryptographically linked)',
      details: [
        {
          title: 'Step 1: Camera Creates Origin',
          content: 'Camera captures image → Computes hash H(original) → Signs with private key → Creates certificate: "Image with hash H existed at time T, signed by Camera C"'
        },
        {
          title: 'Step 2: Editor Creates Transformation Proof',
          content: 'Editor takes signed original → Applies edit (e.g., grayscale) → Generates ZK proof that: "edited_image = grayscale(original_image) AND original_image has hash H"'
        },
        {
          title: 'Step 3: Verifier Checks Everything',
          content: '1. Verify camera signature on hash H (proves authentic origin)\n2. Verify ZK proof (proves correct transformation)\n3. Check edited image matches proof output\n4. Check hash in proof matches hash in signature'
        },
        {
          title: 'Why the Chain is Unbreakable',
          content: 'Each link depends on the previous:\n• Can\'t fake signature without camera\'s key\n• Can\'t fake proof without matching original\n• Can\'t substitute different original (hash wouldn\'t match)\n• Can\'t hide extra edits (proof wouldn\'t verify)'
        },
        {
          title: 'The Trust Model',
          content: 'You trust: 1) The camera manufacturer\'s public key is legitimate, 2) The math behind ZK-SNARKs is sound (peer-reviewed cryptography). You DON\'T need to trust: the editor, any server, or anyone in between.'
        }
      ]
    }
  ];

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      <div className="bg-slate-900/50 px-6 py-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white">🎓 How Does It Actually Work?</h2>
        <p className="text-sm text-slate-400 mt-1">
          Click each question to understand the cryptography behind VerITAS
        </p>
      </div>

      <div className="divide-y divide-slate-700">
        {sections.map((section) => (
          <div key={section.id} className="group">
            <button
              onClick={() => setExpanded(expanded === section.id ? null : section.id)}
              className="w-full px-6 py-4 text-left hover:bg-slate-700/30 transition-colors"
            >
              <div className="flex items-start gap-4">
                <span className="text-2xl">{section.icon}</span>
                <div className="flex-1">
                  <h3 className="text-white font-medium group-hover:text-blue-400 transition-colors">
                    {section.question}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    {section.shortAnswer}
                  </p>
                </div>
                <span className={`text-slate-400 transition-transform ${expanded === section.id ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </div>
            </button>

            {expanded === section.id && (
              <div className="px-6 pb-6 space-y-4 bg-slate-900/30">
                {section.details.map((detail, idx) => (
                  <div key={idx} className="pl-12">
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <h4 className="text-blue-400 font-medium text-sm mb-2">
                        {idx + 1}. {detail.title}
                      </h4>
                      <p className="text-slate-300 text-sm whitespace-pre-line">
                        {detail.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
