const EmptyState = ({ 
  icon: Icon, 
  title = 'Aucune donnée', 
  description = 'Aucune donnée disponible pour le moment',
  action 
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && (
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-gray-400" />
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-4 max-w-sm">{description}</p>
      {action}
    </div>
  );
};

export default EmptyState;
