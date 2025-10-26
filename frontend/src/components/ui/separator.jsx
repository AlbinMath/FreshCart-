import React from 'react';

const Separator = ({ className = '', ...props }) => (
  <hr className={`border-t border-gray-200 ${className}`} {...props} />
);

export { Separator };