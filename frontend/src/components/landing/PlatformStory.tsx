import React from 'react';
import { Activity, Box, Layers, SplitSquareVertical } from 'lucide-react';

export const PlatformStory: React.FC = () => {
  const capabilities = [
    {
      id: 'segmentation',
      icon: Layers,
      title: 'Anatomical Segmentation',
      subtitle: 'Bilateral & Five-Lobe AI Separation',
      desc: 'Automated thoracic CT segmentation utilizing verified 2D U-Net ResNet-34 backbones. Distinguishes right and left lung boundaries as well as individual pulmonary lobar compartments with sub-millimeter precision.',
      tags: ['lungmask R231', 'LTRCLobes', 'Bilateral & Lobar'],
      accentColor: '#0D9488',
    },
    {
      id: 'volumetry',
      icon: Activity,
      title: 'Volumetric Intelligence',
      subtitle: 'Quantitative Morphometry & HU Statistics',
      desc: 'Calculates physical parenchyma volume (mL and Liters) with voxel spacing calibration. Extracts complete attenuation profiles including mean, standard deviation, and tissue density ranges directly from calibrated Hounsfield Units.',
      tags: ['Continuous Voxel Integration', 'L/R Ratio', 'HU Density Profiles'],
      accentColor: '#38BDF8',
    },
    {
      id: 'mpr',
      icon: SplitSquareVertical,
      title: 'Interactive Imaging',
      subtitle: 'Multi-Planar Reconstruction & 3D Mesh',
      desc: 'Experience full radiology workstation navigation across synchronized Axial, Coronal, and Sagittal planes. Reconstructs physical 3D surface meshes on demand using Marching Cubes algorithms with zero loss of spatial orientation.',
      tags: ['Synchronized Crosshairs', 'Marching Cubes 3D', 'LPS+ Coordinates'],
      accentColor: '#14B8A6',
    },
  ];

  return (
    <section id="platform" className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto select-none">
      {/* Section Header with high contrast */}
      <div className="max-w-2xl mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0F1523] border border-[#222F43] text-xs font-mono text-[#38BDF8] tracking-wider uppercase mb-3 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse" />
          <span className="font-semibold">Platform Architecture</span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#FFFFFF]">
          Transforming Thoracic Imaging Into Insight.
        </h2>
        <p className="mt-4 text-sm sm:text-base text-[#CBD5E1] leading-relaxed">
          Engineered for academic medical centers, thoracic oncology researchers, and computer vision engineers examining pulmonary structure and function.
        </p>
      </div>

      {/* 3 Capabilities Grid with solid high-contrast backgrounds */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {capabilities.map((cap) => {
          const Icon = cap.icon;
          return (
            <div
              key={cap.id}
              className="group relative p-7 sm:p-8 rounded-2xl bg-[#0F1523]/95 border border-[#222F43] hover:border-[#0D9488]/80 transition-all duration-300 shadow-xl backdrop-blur-md flex flex-col justify-between"
            >
              <div>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-105 border border-[#222F43]"
                  style={{ backgroundColor: `${cap.accentColor}18`, color: cap.accentColor }}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-[#FFFFFF] tracking-tight">{cap.title}</h3>
                <span className="text-xs font-mono text-[#38BDF8] block mt-1 mb-3.5 font-semibold">
                  {cap.subtitle}
                </span>
                <p className="text-sm text-[#CBD5E1] leading-relaxed">{cap.desc}</p>
              </div>

              <div className="mt-8 pt-5 border-t border-[#222F43] flex flex-wrap gap-2">
                {cap.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-[#161F30] text-[#CBD5E1] border border-[#222F43]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
