import { useEffect } from 'react';

function DynamicStyles({ settings }) {
  useEffect(() => {
    // Remove any existing dynamic style tag
    const existingStyle = document.getElementById('dynamic-status-styles');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Create new style element
    const style = document.createElement('style');
    style.id = 'dynamic-status-styles';
    
    // Generate CSS rules for each status
    const rules = settings.customStatuses.map(status => `
      .color-coded select[data-status="${status.id}"] {
        background-color: ${status.color};
      }
    `).join('\n');

    style.textContent = rules;
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, [settings.customStatuses]);

  return null;
}

export default DynamicStyles; 