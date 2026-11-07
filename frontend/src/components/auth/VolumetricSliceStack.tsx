import React, { useEffect, useRef } from 'react';

export const VolumetricSliceStack: React.FC<{ className?: string }> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let time = 0;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 400;
      canvas.height = canvas.parentElement?.clientHeight || 450;
    };
    resize();
    window.addEventListener('resize', resize);

    const slices = 5;
    const sliceWidth = 240;
    const sliceHeight = 160;

    const draw = () => {
      time += 0.018;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2 + 10;

      // Draw subtle isometric grid lines in background
      ctx.strokeStyle = 'rgba(34, 47, 67, 0.4)';
      ctx.lineWidth = 1;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(centerX - 180 + i * 40, centerY - 140);
        ctx.lineTo(centerX + 180 + i * 40, centerY + 140);
        ctx.stroke();
      }

      // Draw floating volumetric CT scan slices
      for (let s = 0; s < slices; s++) {
        const offsetZ = (s - (slices - 1) / 2) * 44;
        const hover = Math.sin(time + s * 0.8) * 4;
        const curY = centerY + offsetZ + hover;

        const isHighlighted = Math.floor((time * 0.6) % slices) === s;

        // Isometric slice polygon
        const p1 = { x: centerX, y: curY - sliceHeight / 2 };
        const p2 = { x: centerX + sliceWidth / 2, y: curY };
        const p3 = { x: centerX, y: curY + sliceHeight / 2 };
        const p4 = { x: centerX - sliceWidth / 2, y: curY };

        // Slice semi-translucent glass fill
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();

        const grad = ctx.createLinearGradient(p4.x, p1.y, p2.x, p3.y);
        if (isHighlighted) {
          grad.addColorStop(0, 'rgba(13, 148, 136, 0.28)');
          grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.22)');
          grad.addColorStop(1, 'rgba(13, 148, 136, 0.15)');
        } else {
          grad.addColorStop(0, 'rgba(22, 31, 48, 0.65)');
          grad.addColorStop(1, 'rgba(15, 21, 35, 0.75)');
        }
        ctx.fillStyle = grad;
        ctx.fill();

        // Slice border outline
        ctx.strokeStyle = isHighlighted ? 'rgba(56, 189, 248, 0.8)' : 'rgba(38, 52, 69, 0.7)';
        ctx.lineWidth = isHighlighted ? 1.5 : 1;
        ctx.stroke();

        // Synthetic anatomical parenchyma contours on the slice
        ctx.strokeStyle = isHighlighted ? 'rgba(56, 189, 248, 0.6)' : 'rgba(13, 148, 136, 0.35)';
        ctx.lineWidth = 1.2;

        // Left lung contour ellipse on slice
        ctx.beginPath();
        ctx.ellipse(centerX - 35, curY, 26, 16, -0.15, 0, Math.PI * 2);
        ctx.stroke();

        // Right lung contour ellipse on slice
        ctx.beginPath();
        ctx.ellipse(centerX + 35, curY, 28, 17, 0.15, 0, Math.PI * 2);
        ctx.stroke();

        // Trachea central marker
        ctx.fillStyle = isHighlighted ? '#38BDF8' : '#14B8A6';
        ctx.beginPath();
        ctx.arc(centerX, curY - 14, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Technical coordinate badge
        ctx.font = '9px "IBM Plex Mono", monospace';
        ctx.fillStyle = isHighlighted ? '#38BDF8' : '#94A3B8';
        ctx.fillText(`AXIAL SLICE Z: 0${s + 1} · HU: -720`, p2.x + 8, curY + 3);
      }

      // Vertical Laser Scanner Beam line traversing the stack
      const beamY = centerY + Math.sin(time * 0.9) * 90;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX - 130, beamY);
      ctx.lineTo(centerX + 130, beamY);
      ctx.stroke();

      // Laser glow flare
      const flareGrad = ctx.createRadialGradient(centerX, beamY, 2, centerX, beamY, 40);
      flareGrad.addColorStop(0, 'rgba(56, 189, 248, 0.7)');
      flareGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = flareGrad;
      ctx.beginPath();
      ctx.arc(centerX, beamY, 40, 0, Math.PI * 2);
      ctx.fill();

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={`w-full h-full block select-none ${className}`} />;
};

