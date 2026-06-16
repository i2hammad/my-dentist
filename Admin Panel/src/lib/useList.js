import { useCallback, useEffect, useState } from 'react';
import api from './api';

// Fetches a paginated admin list endpoint and exposes data/counts/pagination.
export default function useList(path, params = {}) {
  const [data, setData] = useState([]);
  const [counts, setCounts] = useState({});
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(params);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const { data: res } = await api.get(path, { params: { page: p, limit: 10, ...params } });
      setData(res.data || []);
      setCounts(res.counts || {});
      setTotal(res.total || 0);
      setPages(res.pages || 1);
      setPage(res.page || p);
    } catch (e) {
      setData([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key]);

  useEffect(() => { load(1); /* eslint-disable-next-line */ }, [key]);

  const remove = async (id, sub) => {
    await api.delete(`${path}/${id}`);
    load(page);
  };
  const patch = async (id, body) => {
    await api.patch(`${path}/${id}`, body);
    load(page);
  };

  return { data, counts, page, pages, total, loading, setPage: (p) => load(p), reload: () => load(page), remove, patch };
}
