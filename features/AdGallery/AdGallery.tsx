import React, { useRef, useEffect, useCallback } from 'react';
import { ads } from './ads';
import { AdItem } from './types';

const AdGallery: React.FC = () => {
    const galleryRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const scrollLeftRef = useRef(0);
    const hasDraggedRef = useRef(false);
    const autoplayIntervalRef = useRef<number | null>(null);

    // Duplicate ads for seamless looping
    const duplicatedAds: AdItem[] = [...ads, ...ads];

    const stopAutoplay = useCallback(() => {
        if (autoplayIntervalRef.current) {
            clearInterval(autoplayIntervalRef.current);
        }
    }, []);

    const startAutoplay = useCallback(() => {
        stopAutoplay();
        autoplayIntervalRef.current = window.setInterval(() => {
            if (galleryRef.current && !isDraggingRef.current) {
                const { scrollLeft, scrollWidth } = galleryRef.current;
                const halfwayPoint = scrollWidth / 2;

                if (scrollLeft + 1 >= halfwayPoint) {
                    // When it reaches the end of the first set, silently jump to the start
                    galleryRef.current.scrollLeft = 0;
                } else {
                    galleryRef.current.scrollLeft += 1;
                }
            }
        }, 20); // Adjust for scroll speed
    }, [stopAutoplay]);

    useEffect(() => {
        startAutoplay();
        return () => stopAutoplay();
    }, [startAutoplay]);
    
    const onMouseDown = (e: React.MouseEvent) => {
        if (!galleryRef.current) return;
        isDraggingRef.current = true;
        hasDraggedRef.current = false;
        startXRef.current = e.pageX - galleryRef.current.offsetLeft;
        scrollLeftRef.current = galleryRef.current.scrollLeft;
        galleryRef.current.style.cursor = 'grabbing';
        stopAutoplay();
    };

    const onMouseLeaveOrUp = () => {
        if (!galleryRef.current || !isDraggingRef.current) return;
        isDraggingRef.current = false;
        galleryRef.current.style.cursor = 'grab';
        startAutoplay();
    };
    
    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingRef.current || !galleryRef.current) return;
        e.preventDefault();
        const x = e.pageX - galleryRef.current.offsetLeft;
        const walk = x - startXRef.current;
        if (Math.abs(walk) > 5) { // Threshold to register as a drag
          hasDraggedRef.current = true;
        }
        galleryRef.current.scrollLeft = scrollLeftRef.current - walk;
    };
    
    // Prevent navigation on drag
    const onClickCapture = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (hasDraggedRef.current) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    const adGalleryCSS = `
      .ad-gallery-wrapper {
        width: 100%;
        height: 40vh;
        max-height: 400px;
        position: relative;
        z-index: 30;
        overflow: hidden;
        cursor: grab;
        -webkit-tap-highlight-color: transparent;
      }
      .ad-gallery-wrapper:active {
        cursor: grabbing;
      }
      .ad-gallery-container {
        display: flex;
        height: 100%;
        /* Let the container be as wide as all its children */
        width: fit-content; 
      }
      .ad-item-link {
        display: block;
        height: 100%;
        width: auto; /* Let image aspect ratio dictate width */
        margin: 0;
        padding: 0;
      }
      .ad-item-link img {
        height: 100%;
        width: auto;
        max-width: none;
        object-fit: cover;
        pointer-events: none; /* Disable native image drag behavior */
      }
    `;

    return (
        <>
            <style>{adGalleryCSS}</style>
            <div
                ref={galleryRef}
                className="ad-gallery-wrapper"
                onMouseDown={onMouseDown}
                onMouseLeave={onMouseLeaveOrUp}
                onMouseUp={onMouseLeaveOrUp}
                onMouseMove={onMouseMove}
            >
                <div className="ad-gallery-container">
                    {duplicatedAds.map((ad, index) => (
                        <a
                            key={`${ad.id}-${index}`}
                            href={ad.link}
                            target={ad.type === 'external' ? '_blank' : '_self'}
                            rel={ad.type === 'external' ? 'noopener noreferrer' : ''}
                            className="ad-item-link"
                            onClickCapture={onClickCapture}
                        >
                            <img src={ad.imageUrl} alt={ad.alt} />
                        </a>
                    ))}
                </div>
            </div>
        </>
    );
};

export default AdGallery;
