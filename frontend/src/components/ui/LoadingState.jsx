import Spinner from './Spinner';

const LoadingState = ({ message = 'Chargement...' }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Spinner size="lg" />
      <p className="mt-4 text-gray-500">{message}</p>
    </div>
  );
};

export default LoadingState;
