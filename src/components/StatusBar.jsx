export function StatusBar({ status, error, onInitialize }) {
    if (error) {
        return (
            <div className="p-4 bg-red-50 border-t border-red-200">
                <p className="text-red-600">{error}</p>
            </div>
        );
    }

    if (status === 'idle') {
        return (
            <div className="p-4 border-t">
                <button
                    onClick={onInitialize}
                    className="w-full p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                    Load Model
                </button>
            </div>
        );
    }

    if (status === 'loading') {
        return (
            <div className="p-4 border-t">
                <p className="text-center text-gray-600">Loading model...</p>
            </div>
        );
    }

    return null;
}
